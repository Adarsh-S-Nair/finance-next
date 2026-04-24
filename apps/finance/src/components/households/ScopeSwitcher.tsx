"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { LuPlus } from "react-icons/lu";
import { FiUserPlus, FiLogOut } from "react-icons/fi";
import { ConfirmOverlay } from "@zervo/ui";
import { authFetch } from "../../lib/api/fetch";
import { useHouseholds } from "../providers/HouseholdsProvider";
import { useToast } from "../providers/ToastProvider";
import HouseholdSwitcherModal from "./HouseholdSwitcherModal";
import HouseholdInviteModal from "./HouseholdInviteModal";
import { HouseholdAvatarStack } from "./HouseholdAvatarStack";

/**
 * The "scope switcher" that lives at the top of the desktop sidebar.
 * Replaces the old Discord-style left-edge rail, which gave 80px of
 * vertical real estate to a feature most users only touch 1–3 times.
 *
 * Each row is a regular-looking sidebar link: a small avatar/logo on
 * the left and the scope's name next to it, with an active-state
 * background matching the rest of the nav. Right-click any household
 * for the invite / leave menu that the rail used to carry.
 */

type HouseholdContextMenu = {
  id: string;
  name: string;
  x: number;
  y: number;
};

const MENU_WIDTH = 208;
const MENU_MARGIN = 6;

function ZervoMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("block bg-[var(--color-fg)]", className)}
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

function ScopeRow({
  href,
  label,
  icon,
  active,
  onContextMenu,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <Link
      href={href}
      onContextMenu={onContextMenu}
      className={clsx(
        "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
        active
          ? "bg-[var(--color-sidebar-active)] text-[var(--color-fg)] font-medium"
          : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60",
      )}
    >
      <span className="w-6 h-6 flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
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
      className="fixed z-[70] p-1 rounded-md bg-[var(--color-floating-bg)] ring-1 ring-[var(--color-floating-border)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]"
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
      <div className="px-3 pt-3 pb-2 space-y-0.5">
        <ScopeRow
          href="/dashboard"
          label="Personal"
          active={!isOnHousehold}
          icon={<ZervoMark className="h-4 w-4" />}
        />
        <AnimatePresence initial={false}>
          {households.map((h) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
            >
              <ScopeRow
                href={`/households/${h.id}/accounts`}
                label={h.name}
                active={h.id === activeHouseholdId}
                onContextMenu={(e) => handleContextMenu(e, h)}
                icon={
                  <HouseholdAvatarStack
                    members={h.members}
                    totalMembers={h.member_count}
                    size={22}
                    fallbackName={h.name}
                    fallbackColor={h.color}
                  />
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
        <button
          type="button"
          onClick={() => setShowSwitcher(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60 transition-colors cursor-pointer"
        >
          <span className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-muted)]">
            <LuPlus className="h-3 w-3" />
          </span>
          <span>Add household</span>
        </button>
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
