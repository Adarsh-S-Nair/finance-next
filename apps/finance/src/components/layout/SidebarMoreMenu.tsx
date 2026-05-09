"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { LuEllipsis, LuSparkles, LuHeadphones } from "react-icons/lu";
import { TbLogout } from "react-icons/tb";
import { FaLock } from "react-icons/fa";
import { ConfirmOverlay, Tooltip, TOOLTIP_SURFACE_CLASSES } from "@zervo/ui";
import { useUser } from "../providers/UserProvider";
import { supabase } from "../../lib/supabase/client";
import UpgradeOverlay from "../UpgradeOverlay";

const POPOVER_GAP = 8;
const POPOVER_WIDTH = 220;

/**
 * Bottom-of-sidebar "..." menu. Anchored popover that opens to the right
 * of the trigger and contains secondary actions (Upgrade, Help, Log
 * out). User identity lives at the top of the sidebar in the scope
 * popover; this menu is just the action drawer. The popover renders
 * into document.body so its position isn't constrained by the narrow
 * floating sidebar.
 */
export default function SidebarMoreMenu() {
  const router = useRouter();
  const { profile, logout } = useUser();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const tier = profile?.subscription_tier ?? "free";

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

  // Anchor the popover to the right edge of the trigger and bottom-align
  // with the trigger's bottom edge so it grows upward from the button
  // (which sits at the bottom of the sidebar — opening upward keeps the
  // menu fully on-screen). We use `bottom` for vertical anchoring instead
  // of `top + translateY(-100%)` because framer-motion animates `x`/`y`
  // via the same `transform` property and would clobber a static
  // translateY.
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
      await Promise.race([
        Promise.resolve(supabase.auth.signOut()),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
      if (typeof window !== "undefined") {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith("sb-")) localStorage.removeItem(key);
        }
      }
      logout();
      router.replace("/");
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
            "flex items-center justify-center w-10 h-10 rounded-md transition-colors cursor-pointer",
            open
              ? "text-[var(--color-fg)] bg-[var(--color-fg)]/[0.08]"
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
                className={clsx(
                  TOOLTIP_SURFACE_CLASSES,
                  "overflow-hidden",
                )}
              >
                <div className="py-1.5">
                  {tier === "free" && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setShowUpgrade(true);
                      }}
                      className={clsx(
                        itemBase,
                        "text-[var(--color-accent)] hover:bg-[var(--color-fg)]/[0.05]",
                      )}
                    >
                      <LuSparkles className="h-[18px] w-[18px] flex-shrink-0" />
                      <span>Upgrade to Pro</span>
                    </button>
                  )}
                  <div
                    className={clsx(
                      itemBase,
                      "text-[var(--color-floating-muted)] opacity-40 cursor-not-allowed",
                    )}
                  >
                    <LuHeadphones className="h-[18px] w-[18px] flex-shrink-0" />
                    <span className="flex-1">Help &amp; Support</span>
                    <FaLock className="h-3 w-3 opacity-60" />
                  </div>
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
                    <span>Log out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <UpgradeOverlay
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
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
