"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LuSettings, LuLogOut } from "react-icons/lu";
import clsx from "clsx";
import { ConfirmOverlay, Drawer, useAnyDrawerOpen } from "@zervo/ui";
import { NAV_GROUPS } from "../nav";
import { useUser } from "../providers/UserProvider";
import { supabase } from "../../lib/supabase/client";
import { isFeatureEnabled } from "../../lib/tierConfig";
import ScopeSwitcher from "../households/ScopeSwitcher";

// The toggle is a 36px circular button anchored at top:14 / left:16 (so it
// reads as centered in the 64px topbar). When the drawer opens we shift it
// to the top-right edge and a hair lower, so its center lines up with the
// avatar of the household row at the top of the scope switcher.
//
// Horizontal: viewport_width − left(16) − button(36) − right(16) = 100vw − 68px
// Vertical:   ScopeSwitcher pt-3(12) + ScopeRow py-2(8) + half-avatar(16)
//             − button-center(32) = 4
const TOGGLE_OPEN_X = "calc(100vw - 68px)";
const TOGGLE_OPEN_Y = 4;

export default function MobileNavMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useUser();
  const [open, setOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anyDrawerOpen = useAnyDrawerOpen();
  // The hamburger and any other drawer's top-left close-chevron occupy
  // the same coordinates on mobile (top:14 left:16). When this menu's
  // own drawer is open we keep the toggle visible — it morphs into an
  // X and animates to the top-right (TOGGLE_OPEN_X) so it doesn't
  // block anything. But when *another* drawer is open (transactions
  // detail, notifications, etc.), our hamburger sits on top of that
  // drawer's chevron at z-90 and steals the tap. Hide it then.
  const otherDrawerOpen = anyDrawerOpen && !open;

  useEffect(() => setMounted(true), []);

  // Close the drawer whenever the route changes — tapping a nav link
  // triggers Next router navigation, and we want the drawer to dismiss
  // in sync rather than relying on each link to do it manually.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close when the viewport grows past the mobile breakpoint. The toggle
  // button is `md:hidden`, so once it hides at md+ the user has no way
  // to dismiss a drawer that was opened on mobile and then resized — we
  // do it for them.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = () => {
      if (mql.matches) setOpen(false);
    };
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const mainItems = NAV_GROUPS
    .flatMap((g) => g.items)
    .filter((item) => !item.disabled)
    .filter((item) => !item.featureFlag || isFeatureEnabled(item.featureFlag));

  const handleLogout = async () => {
    try {
      setIsSigningOut(true);
      logout();
      await supabase.auth.signOut();
      router.replace("/");
    } finally {
      setIsSigningOut(false);
      setShowLogout(false);
      setOpen(false);
    }
  };

  // The toggle has to sit ABOVE the drawer (z-80), but its parent
  // (AppTopbar) sets `sticky z-40` which creates its own stacking
  // context — anything z-90 inside that context is still effectively
  // z-40 in the root context, so the drawer would cover it. Portal to
  // body to escape, matching the drawer's own portaling.
  const toggle = (
    <motion.button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      className="md:hidden fixed top-3.5 left-4 z-[90] inline-flex items-center justify-center h-9 w-9 rounded-full text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
      animate={{
        x: open ? TOGGLE_OPEN_X : "0px",
        y: open ? TOGGLE_OPEN_Y : 0,
      }}
      transition={{ type: "tween", duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <MorphingMenuIcon open={open} />
    </motion.button>
  );

  return (
    <>
      {mounted && !otherDrawerOpen && createPortal(toggle, document.body)}

      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        size="sm"
        side="left"
        hideCloseButton
        noPadding
      >
        <div className="h-full flex flex-col">
          <ScopeSwitcher hideChevron />

          <nav className="flex-1 overflow-y-auto px-3 pt-3 space-y-0.5">
            {mainItems.map((item) => (
              <NavRow
                key={item.href}
                href={item.href}
                label={item.label}
                Icon={item.icon}
                active={pathname.startsWith(item.href)}
              />
            ))}
          </nav>

          <div className="px-3 pt-3 pb-3 border-t border-[var(--color-fg)]/[0.06] space-y-0.5">
            <NavRow
              href="/settings"
              label="Settings"
              Icon={LuSettings}
              active={pathname.startsWith("/settings")}
            />
            <button
              type="button"
              onClick={() => setShowLogout(true)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05] transition-colors"
            >
              <LuLogOut className="w-[18px] h-[18px] flex-shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </Drawer>

      <ConfirmOverlay
        isOpen={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
        title="Sign out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        variant="primary"
        busy={isSigningOut}
      />
    </>
  );
}

// Drawer nav row — visually matches the desktop SidebarItem (square
// corners, 3px left accent bar on active, fg-tinted bg) so navigating
// between viewports doesn't change the rendering of the active state.
// We don't share SidebarItem itself because its framer-motion layoutIds
// would compete with the desktop sidebar's items (they're mounted on
// every viewport via display:none) and end up syncing animations across
// two unrelated lists.
function NavRow({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon?: import("react-icons").IconType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "group relative flex items-center gap-3 px-3 py-2 text-sm transition-colors",
        active
          ? "text-[var(--color-fg)] font-medium"
          : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
      )}
    >
      {active && (
        <>
          <span className="absolute inset-0 bg-[var(--color-fg)]/[0.08]" />
          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[var(--color-fg)]" />
        </>
      )}
      {Icon && (
        <Icon className="w-[18px] h-[18px] flex-shrink-0 relative z-[1]" />
      )}
      <span className="relative z-[1]">{label}</span>
    </Link>
  );
}

// Three stacked bars that morph into an X. Top + bottom rotate ±45° and
// converge to the middle row; the middle bar fades out. Driven entirely
// by the `open` prop so framer-motion can interpolate smoothly. Sized
// small + thin (14px wide, 1px strokes) so it reads as restrained chrome
// rather than a chunky control.
function MorphingMenuIcon({ open }: { open: boolean }) {
  const transition = { type: "tween" as const, duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as const };
  return (
    <span className="relative block w-3.5 h-2.5" aria-hidden="true">
      <motion.span
        className="absolute left-0 right-0 h-px rounded-full bg-current"
        style={{ top: 0 }}
        animate={{ y: open ? 5 : 0, rotate: open ? 45 : 0 }}
        transition={transition}
      />
      <motion.span
        className="absolute left-0 right-0 h-px rounded-full bg-current"
        style={{ top: 5 }}
        animate={{ opacity: open ? 0 : 1, scaleX: open ? 0 : 1 }}
        transition={transition}
      />
      <motion.span
        className="absolute left-0 right-0 h-px rounded-full bg-current"
        style={{ top: 10 }}
        animate={{ y: open ? -5 : 0, rotate: open ? -45 : 0 }}
        transition={transition}
      />
    </span>
  );
}
