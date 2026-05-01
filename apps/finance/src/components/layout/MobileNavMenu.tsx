"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LuSettings, LuLogOut } from "react-icons/lu";
import clsx from "clsx";
import { ConfirmOverlay, Drawer } from "@zervo/ui";
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

  useEffect(() => setMounted(true), []);

  // Close the drawer whenever the route changes — tapping a nav link
  // triggers Next router navigation, and we want the drawer to dismiss
  // in sync rather than relying on each link to do it manually.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
      {mounted && createPortal(toggle, document.body)}

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
            {mainItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-[var(--color-sidebar-active)] text-[var(--color-fg)]"
                      : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60",
                  )}
                >
                  {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="px-3 pt-3 pb-3 border-t border-[var(--color-fg)]/[0.06] space-y-0.5">
            <Link
              href="/settings"
              className={clsx(
                "flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors",
                pathname.startsWith("/settings")
                  ? "bg-[var(--color-sidebar-active)] text-[var(--color-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60",
              )}
            >
              <LuSettings className="w-4 h-4 flex-shrink-0" />
              <span>Settings</span>
            </Link>
            <button
              type="button"
              onClick={() => setShowLogout(true)}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60 transition-colors"
            >
              <LuLogOut className="w-4 h-4 flex-shrink-0" />
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
