"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { NAV_GROUPS } from "./nav";
import { LuSettings, LuLogOut } from "react-icons/lu";
import clsx from "clsx";
import ConfirmDialog from "./ui/ConfirmDialog";
import { useUser } from "./UserProvider";
import { supabase } from "../lib/supabaseClient";

export default function MobileNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useUser();
  const [showLogout, setShowLogout] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Flatten nav groups to get main items, filtering out disabled ones if needed
  const mainItems = NAV_GROUPS.flatMap(g => g.items).filter(item => !item.disabled);

  const navItems = [
    ...mainItems,
    { href: "/settings", label: "Settings", icon: LuSettings }
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
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none md:hidden">
        <div className="pointer-events-auto bg-[var(--color-surface)]/70 border border-[var(--color-border)]/50 shadow-2xl shadow-black/20 rounded-2xl px-1.5 py-1.5 flex items-center gap-0.5 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--color-surface)]/60">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "relative flex items-center justify-center h-10 rounded-xl transition-all duration-200",
                  isActive
                    ? "px-3 text-[var(--color-fg)] bg-[var(--color-fg)]/5"
                    : "w-10 text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/5"
                )}
              >
                <div className="relative z-10 flex items-center gap-1.5">
                  {Icon && (
                    <Icon
                      className="w-4 h-4"
                    />
                  )}

                  {isActive && (
                    <span
                      className="text-[10px] font-normal whitespace-nowrap overflow-hidden animate-fade-in-item"
                    >
                      {item.label}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

        </div>
      </div>

      <ConfirmDialog
        isOpen={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
        title="Sign out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        busyLabel="Signing out..."
        cancelLabel="Cancel"
        variant="primary"
        busy={isSigningOut}
      />
    </>
  );
}
