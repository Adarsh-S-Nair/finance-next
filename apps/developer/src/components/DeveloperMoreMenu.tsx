"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { LuEllipsis, LuMoon, LuSun } from "react-icons/lu";
import { TbLogout } from "react-icons/tb";
import { ConfirmOverlay, Tooltip, TOOLTIP_SURFACE_CLASSES } from "@zervo/ui";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "./ThemeProvider";

const POPOVER_GAP = 8;
const POPOVER_WIDTH = 240;

type Props = {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  initials: string;
};

/**
 * Bottom-of-sidebar "..." menu for the developer portal. Same pattern as
 * finance's SidebarMoreMenu and admin's AdminMoreMenu — identity + theme
 * toggle + sign-out in a popover anchored to an ellipsis trigger.
 */
export default function DeveloperMoreMenu({ name, email, avatarUrl, initials }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t))
        return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        bottom: window.innerHeight - rect.bottom,
        left: rect.right + POPOVER_GAP,
      });
    };
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    try {
      setIsSigningOut(true);
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } finally {
      setIsSigningOut(false);
      setShowLogout(false);
    }
  };

  const itemBase =
    "w-full flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors";

  return (
    <>
      <Tooltip content="More" side="right">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="More menu"
          aria-expanded={open}
          className={clsx(
            "flex items-center justify-center w-full h-10 transition-colors cursor-pointer",
            open
              ? "text-[var(--color-fg)] bg-[var(--color-fg)]/[0.05]"
              : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
          )}
        >
          <LuEllipsis className="h-[18px] w-[18px]" />
        </button>
      </Tooltip>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={popoverRef}
                role="menu"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  bottom: pos.bottom,
                  left: pos.left,
                  width: POPOVER_WIDTH,
                  zIndex: 100,
                }}
                className={clsx(TOOLTIP_SURFACE_CLASSES, "overflow-hidden")}
              >
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--color-floating-border)]">
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-[var(--color-accent)] flex items-center justify-center overflow-hidden text-[11px] font-semibold text-[var(--color-on-accent)]">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {name && (
                      <div className="text-[13px] font-medium text-[var(--color-floating-fg)] truncate leading-tight">
                        {name}
                      </div>
                    )}
                    {email && (
                      <div className="text-[11px] text-[var(--color-floating-muted)] truncate leading-tight mt-0.5">
                        {email}
                      </div>
                    )}
                  </div>
                </div>

                <div className="py-1.5">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className={clsx(
                      itemBase,
                      "text-[var(--color-floating-muted)] hover:text-[var(--color-floating-fg)] hover:bg-[var(--color-fg)]/[0.05]",
                    )}
                  >
                    {theme === "dark" ? (
                      <LuSun className="h-[18px] w-[18px] flex-shrink-0" />
                    ) : (
                      <LuMoon className="h-[18px] w-[18px] flex-shrink-0" />
                    )}
                    <span>
                      {theme === "dark" ? "Light mode" : "Dark mode"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setShowLogout(true);
                    }}
                    className={clsx(
                      itemBase,
                      "text-[var(--color-floating-muted)] hover:text-[var(--color-floating-fg)] hover:bg-[var(--color-fg)]/[0.05]",
                    )}
                  >
                    <TbLogout className="h-[18px] w-[18px] flex-shrink-0" />
                    <span>Sign out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <ConfirmOverlay
        isOpen={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleSignOut}
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
