"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LuSettings, LuLogOut, LuMenu } from "react-icons/lu";
import clsx from "clsx";
import { ConfirmOverlay, Drawer } from "@zervo/ui";
import { NAV_GROUPS } from "../nav";
import { useUser } from "../providers/UserProvider";
import { supabase } from "../../lib/supabase/client";
import { isFeatureEnabled } from "../../lib/tierConfig";

export default function MobileNavMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useUser();
  const [open, setOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const mainItems = NAV_GROUPS
    .flatMap((g) => g.items)
    .filter((item) => !item.disabled)
    .filter((item) => !item.featureFlag || isFeatureEnabled(item.featureFlag));

  const navItems = [
    ...mainItems,
    { href: "/settings", label: "Settings", icon: LuSettings },
  ];

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-full text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
      >
        <LuMenu className="h-5 w-5" />
      </button>

      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Menu"
        size="sm"
        side="left"
      >
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-3 px-2 py-2.5 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-[var(--color-surface-alt)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60",
                )}
              >
                {Icon && (
                  <Icon
                    className={clsx(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]",
                    )}
                  />
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setShowLogout(true)}
            className="mt-2 flex items-center gap-3 px-2 py-2.5 rounded-md text-sm text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60 transition-colors"
          >
            <LuLogOut className="w-4 h-4 flex-shrink-0 text-[var(--color-muted)]" />
            <span>Sign out</span>
          </button>
        </nav>
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
