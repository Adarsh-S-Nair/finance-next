"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { LuPlus } from "react-icons/lu";
import { FiUserPlus, FiLogOut } from "react-icons/fi";
import Tooltip from "../ui/Tooltip";
import { authFetch } from "../../lib/api/fetch";
import { useHouseholds } from "../providers/HouseholdsProvider";
import { useToast } from "../providers/ToastProvider";
import ConfirmOverlay from "../ui/ConfirmOverlay";
import HouseholdSwitcherModal from "../households/HouseholdSwitcherModal";
import HouseholdInviteModal from "../households/HouseholdInviteModal";

type HouseholdContextMenu = {
  id: string;
  name: string;
  x: number;
  y: number;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The Discord-style active indicator: a short vertical bar on the left edge
 * that grows when active and collapses when not.
 */
function ActiveIndicator({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-fg)] transition-all duration-200",
        active ? "opacity-100" : "opacity-0 group-hover:opacity-60 group-hover:h-3",
      )}
    />
  );
}

function ZervoMark({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "block h-7 w-7 transition-colors duration-200",
        active
          ? "bg-[var(--color-on-accent,white)]"
          // Inactive: dark logo on the neutral bubble, but invert to the
          // on-accent color on hover so it stays visible when the bubble
          // swaps to the accent fill. Without this the logo vanishes
          // against the hovered accent background.
          : "bg-[var(--color-fg)] group-hover:bg-[var(--color-on-accent,white)]",
      )}
      style={{
        maskImage: "url(/logo.svg)",
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: "url(/logo.svg)",
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

type BubbleProps = {
  active?: boolean;
  color?: string;
  children: React.ReactNode;
};

// rounded-full resolves to 9999px, which means the bulk of a 200ms transition
// from full -> rounded-xl (12px) renders as "still a circle" and only snaps
// at the end. Using a pixel value equal to half the bubble width (22px for a
// 44px bubble) keeps the whole animation range visible.
const BUBBLE_SHAPE_TRANSITION =
  "transition-[border-radius,background-color,color] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]";
const BUBBLE_CIRCLE_RADIUS = "rounded-[22px]";

function Bubble({ active = false, color, children }: BubbleProps) {
  const inlineStyle = color
    ? ({ ["--bubble-color" as string]: color } as React.CSSProperties)
    : undefined;

  if (color) {
    return (
      <span
        style={inlineStyle}
        className={clsx(
          "flex h-11 w-11 items-center justify-center overflow-hidden text-sm font-semibold text-white bg-[var(--bubble-color)]",
          BUBBLE_SHAPE_TRANSITION,
          active ? "rounded-xl" : clsx(BUBBLE_CIRCLE_RADIUS, "group-hover:rounded-xl"),
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "flex h-11 w-11 items-center justify-center overflow-hidden text-sm font-semibold",
        BUBBLE_SHAPE_TRANSITION,
        active
          ? "rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent,white)]"
          : clsx(
              BUBBLE_CIRCLE_RADIUS,
              "bg-[var(--color-surface-alt)] text-[var(--color-fg)] group-hover:rounded-xl group-hover:bg-[var(--color-accent)] group-hover:text-[var(--color-on-accent,white)]",
            ),
      )}
    >
      {children}
    </span>
  );
}

const MENU_WIDTH = 208;
const MENU_MARGIN = 6;

function HouseholdContextMenuView({
  menu,
  onInvite,
  onLeave,
  onClose,
}: {
  menu: HouseholdContextMenu;
  onInvite: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("contextmenu", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("contextmenu", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
  const clampedX = Math.min(menu.x + MENU_MARGIN, viewportWidth - MENU_WIDTH - MENU_MARGIN);

  const rowClass =
    "flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[13px] rounded-md transition-colors cursor-pointer";

  return createPortal(
    <motion.div
      ref={menuRef}
      role="menu"
      initial={{ opacity: 0, scale: 0.97, y: -2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ top: menu.y + MENU_MARGIN, left: clampedX, width: MENU_WIDTH }}
      className="fixed z-[70] p-1 rounded-xl bg-[var(--color-surface-alt)] ring-1 ring-[var(--color-fg)]/[0.08] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onInvite}
        className={clsx(rowClass, "text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.06]")}
      >
        <FiUserPlus className="h-4 w-4 flex-shrink-0" />
        <span>Invite to household</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onLeave}
        className={clsx(rowClass, "text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_92%)]")}
      >
        <FiLogOut className="h-4 w-4 flex-shrink-0" />
        <span>Leave household</span>
      </button>
    </motion.div>,
    document.body,
  );
}

export default function HouseholdRail() {
  const pathname = usePathname();
  const router = useRouter();
  const { households, refresh } = useHouseholds();
  const { setToast } = useToast();

  const [showSwitcher, setShowSwitcher] = useState(false);
  const [menu, setMenu] = useState<HouseholdContextMenu | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<{ id: string; name: string } | null>(null);

  const isOnHousehold = pathname.startsWith("/households/");
  const activeHouseholdId = isOnHousehold
    ? pathname.match(/^\/households\/([^/]+)/)?.[1] ?? null
    : null;

  const handleContextMenu = (e: React.MouseEvent, h: { id: string; name: string }) => {
    e.preventDefault();
    setMenu({ id: h.id, name: h.name, x: e.clientX, y: e.clientY });
  };

  const openInvite = () => {
    if (!menu) return;
    setInviteId(menu.id);
    setMenu(null);
  };

  const openLeave = () => {
    if (!menu) return;
    setLeaveTarget({ id: menu.id, name: menu.name });
    setMenu(null);
  };

  const handleLeave = async () => {
    if (!leaveTarget) return;
    try {
      const res = await authFetch(`/api/households/${leaveTarget.id}/members/me`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          title: "Couldn't leave",
          description: data?.message || data?.error,
          variant: "error",
        });
        setLeaveTarget(null);
        return;
      }
      await refresh();
      setToast({
        title: data?.deleted ? "Household deleted" : "Left household",
        variant: "success",
      });
      if (pathname.startsWith(`/households/${leaveTarget.id}`)) {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("[households] leave error", err);
      setToast({ title: "Couldn't leave", variant: "error" });
    } finally {
      setLeaveTarget(null);
    }
  };

  return (
    <>
      <aside
        style={{ transform: "translateY(var(--rail-offset, 0px))", transition: "transform 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)", willChange: "transform" }}
        className={clsx(
          "hidden xl:flex flex-col fixed top-0 left-0 bottom-16 w-20 z-50",
          "border-r border-[var(--color-fg)]/[0.06] bg-[var(--color-content-bg)]",
        )}
      >
        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto scrollbar-thin pt-5 pb-3">
          {/* Personal — Zervo logo */}
          <Tooltip content="Personal" side="right">
            <Link
              href="/dashboard"
              className="group relative flex h-11 w-full items-center justify-center"
              aria-label="Personal"
            >
              <ActiveIndicator active={!isOnHousehold} />
              <Bubble active={!isOnHousehold}>
                <ZervoMark active={!isOnHousehold} />
              </Bubble>
            </Link>
          </Tooltip>

          <div className="mx-auto my-1 h-px w-8 bg-[var(--color-fg)]/[0.08]" />

          {/* Households */}
          <AnimatePresence initial={false}>
            {households.map((h) => {
              const active = h.id === activeHouseholdId;
              return (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Tooltip content={h.name} side="right">
                    <Link
                      href={`/households/${h.id}/accounts`}
                      onContextMenu={(e) => handleContextMenu(e, h)}
                      className="group relative flex h-11 w-full items-center justify-center"
                      aria-label={h.name}
                    >
                      <ActiveIndicator active={active} />
                      <Bubble active={active} color={h.color}>
                        <span>{initialsFor(h.name)}</span>
                      </Bubble>
                    </Link>
                  </Tooltip>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Add-household circle */}
          <Tooltip content="Create or join a household" side="right">
            <button
              onClick={() => setShowSwitcher(true)}
              className="group relative flex h-11 w-full items-center justify-center"
              aria-label="Create or join a household"
            >
              <span
                className={clsx(
                  "flex h-11 w-11 items-center justify-center border border-dashed border-[var(--color-border)] text-[var(--color-muted)]",
                  BUBBLE_SHAPE_TRANSITION,
                  BUBBLE_CIRCLE_RADIUS,
                  "group-hover:rounded-xl group-hover:border-solid group-hover:border-[var(--color-accent)] group-hover:bg-[var(--color-accent)]/10 group-hover:text-[var(--color-accent)]",
                )}
              >
                <LuPlus className="h-5 w-5" />
              </span>
            </button>
          </Tooltip>
        </nav>
      </aside>

      {menu && (
        <HouseholdContextMenuView
          menu={menu}
          onInvite={openInvite}
          onLeave={openLeave}
          onClose={() => setMenu(null)}
        />
      )}

      <HouseholdSwitcherModal isOpen={showSwitcher} onClose={() => setShowSwitcher(false)} />

      <HouseholdInviteModal
        isOpen={!!inviteId}
        householdId={inviteId}
        onClose={() => setInviteId(null)}
      />

      <ConfirmOverlay
        isOpen={!!leaveTarget}
        onCancel={() => setLeaveTarget(null)}
        onConfirm={handleLeave}
        title={leaveTarget ? `Leave ${leaveTarget.name}?` : "Leave household"}
        description="If you're the last member, the household will be deleted. Otherwise you can rejoin later with a new invite code."
        confirmLabel="Leave"
        variant="danger"
      />
    </>
  );
}
