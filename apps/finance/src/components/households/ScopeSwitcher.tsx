"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { LuPlus, LuChevronDown } from "react-icons/lu";
import { FiUserPlus, FiLogOut } from "react-icons/fi";
import { ConfirmOverlay, TOOLTIP_SURFACE_CLASSES } from "@zervo/ui";
import { authFetch } from "../../lib/api/fetch";
import {
  useHouseholds,
  type HouseholdSummary,
} from "../providers/HouseholdsProvider";
import { useToast } from "../providers/ToastProvider";
import HouseholdSwitcherModal from "./HouseholdSwitcherModal";
import HouseholdInviteModal from "./HouseholdInviteModal";
import { HouseholdAvatarStack } from "./HouseholdAvatarStack";

/**
 * The "scope switcher" at the top of the desktop sidebar. Replaces the
 * old Discord-style rail. Shows just the current scope by default —
 * large avatar + name + a down-chevron — and reveals the other scopes
 * (plus an "add household" affordance) inline when expanded.
 */

type HouseholdContextMenu = {
  id: string;
  name: string;
  x: number;
  y: number;
};

const MENU_WIDTH = 208;
const MENU_MARGIN = 6;

// Rounded-square Personal tile — fg-on-bg inversion so it reads as
// black-on-white in light mode and white-on-black in dark mode,
// matching the tablet bubble's visual weight. Border radius is
// relative to the tile size so both 40px and 28px tiles look like
// the same family of shape.
function PersonalTile({ size }: { size: number }) {
  const inner = Math.round(size * 0.55);
  const radius = Math.max(6, Math.round(size * 0.28));
  return (
    <span
      className="flex items-center justify-center flex-shrink-0 bg-[var(--color-brand)]"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <span
        aria-hidden
        className="block bg-[var(--color-on-brand)]"
        style={{
          width: inner,
          height: inner,
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
    </span>
  );
}

// Rounded-square household tile — matches PersonalTile's shape but
// uses a subtle surface-alt backdrop so the avatar stack inside
// doesn't float unanchored on the sidebar background.
function HouseholdTile({
  household,
  size,
}: {
  household: HouseholdSummary;
  size: number;
}) {
  const inset = Math.max(2, Math.round(size * 0.08));
  const radius = Math.max(6, Math.round(size * 0.28));
  const stackSize = size - inset * 2;
  return (
    <span
      className="flex items-center justify-center flex-shrink-0 bg-[var(--color-surface-alt)] overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <HouseholdAvatarStack
        members={household.members}
        totalMembers={household.member_count}
        size={stackSize}
        fallbackName={household.name}
        fallbackColor={household.color}
      />
    </span>
  );
}

function ScopeAvatar({
  household,
  size,
}: {
  household: HouseholdSummary | null;
  size: number;
}) {
  if (!household) return <PersonalTile size={size} />;
  return <HouseholdTile household={household} size={size} />;
}

function ScopeRow({
  href,
  label,
  size,
  active,
  showChevron,
  expanded,
  onClick,
  onContextMenu,
  children,
}: {
  href?: string;
  label: string;
  size: "md" | "lg";
  active?: boolean;
  showChevron?: boolean;
  expanded?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  children: React.ReactNode; // the avatar
}) {
  const rowClass = clsx(
    "group w-full flex items-center gap-3 px-2.5 rounded-md transition-colors text-left",
    size === "lg" ? "py-2" : "py-1.5",
    active
      ? "bg-[var(--color-sidebar-active)] text-[var(--color-fg)]"
      : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60",
  );
  const content = (
    <>
      <span className="flex items-center justify-center flex-shrink-0">
        {children}
      </span>
      <span
        className={clsx(
          "flex-1 min-w-0 truncate",
          size === "lg" ? "text-sm font-medium" : "text-[13px]",
        )}
      >
        {label}
      </span>
      {showChevron && (
        <LuChevronDown
          className={clsx(
            "h-4 w-4 text-[var(--color-muted)] transition-transform",
            expanded && "rotate-180",
          )}
        />
      )}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={rowClass}
      >
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={clsx(rowClass, "cursor-pointer")}>
      {content}
    </button>
  );
}

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
      className={clsx("fixed z-[70] p-1", TOOLTIP_SURFACE_CLASSES)}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onInvite}
        className={clsx(rowClass, "text-[var(--color-floating-fg)] hover:bg-[color-mix(in_oklab,var(--color-floating-fg),transparent_86%)]")}
      >
        <FiUserPlus className="h-4 w-4 flex-shrink-0" />
        <span>Invite to household</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onLeave}
        className={clsx(rowClass, "text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_88%)]")}
      >
        <FiLogOut className="h-4 w-4 flex-shrink-0" />
        <span>Leave household</span>
      </button>
    </motion.div>,
    document.body,
  );
}

export default function ScopeSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { households, refresh } = useHouseholds();
  const { setToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [menu, setMenu] = useState<HouseholdContextMenu | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<{ id: string; name: string } | null>(null);

  const activeHouseholdId = pathname.match(/^\/households\/([^/]+)/)?.[1] ?? null;
  const activeHousehold =
    households.find((h) => h.id === activeHouseholdId) ?? null;
  const isOnPersonal = !activeHouseholdId;

  // Collapse the dropdown when the user actually navigates to a new
  // scope — the current-scope row at the top will update to match.
  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

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

  // Scopes that go into the expanded dropdown (everything except the
  // currently-active one). Personal shows up here whenever we're on a
  // household, and vice versa.
  const otherHouseholds = activeHouseholdId
    ? households.filter((h) => h.id !== activeHouseholdId)
    : households;

  return (
    <>
      <div className="px-3 pt-3 pb-2">
        {/* Current scope — always visible, triggers the dropdown. Use a
            button rather than a Link so tapping it doesn't navigate
            (the user's already here); it just toggles the list. */}
        <ScopeRow
          size="lg"
          label={activeHousehold ? activeHousehold.name : "Personal"}
          showChevron
          expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <ScopeAvatar household={activeHousehold} size={40} />
        </ScopeRow>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-1 space-y-0.5">
                {!isOnPersonal && (
                  <ScopeRow
                    size="md"
                    href="/dashboard"
                    label="Personal"
                    onClick={() => setExpanded(false)}
                  >
                    <PersonalTile size={28} />
                  </ScopeRow>
                )}
                {otherHouseholds.map((h) => (
                  <ScopeRow
                    key={h.id}
                    size="md"
                    href={`/households/${h.id}/accounts`}
                    label={h.name}
                    onClick={() => setExpanded(false)}
                    onContextMenu={(e) => handleContextMenu(e, h)}
                  >
                    <HouseholdTile household={h} size={28} />
                  </ScopeRow>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(false);
                    setShowSwitcher(true);
                  }}
                  className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md text-[13px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60 transition-colors cursor-pointer"
                >
                  <span className="w-7 h-7 flex items-center justify-center flex-shrink-0 rounded-lg border border-dashed border-[var(--color-border)]">
                    <LuPlus className="h-3.5 w-3.5" />
                  </span>
                  <span>Add household</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider between scope switcher and the rest of the nav. */}
      <div className="mx-3 border-t border-[var(--color-fg)]/[0.06]" />

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
