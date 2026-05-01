"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { LuPlus } from "react-icons/lu";
import { TOOLTIP_SURFACE_CLASSES } from "@zervo/ui";
import { useHouseholds } from "../providers/HouseholdsProvider";
import HouseholdSwitcherModal from "./HouseholdSwitcherModal";
import { HouseholdTile, PersonalTile, ScopeAvatar } from "./ScopeSwitcher";

/**
 * Compact scope switcher used in the tablet sidebar (collapsed at 80px).
 * Renders the active scope's avatar as a button; clicking opens a small
 * popover anchored to the trigger with the other scopes + an "Add"
 * affordance. Replaces the full-width horizontal household rail that
 * used to drop down across the whole top of the app.
 */
const POPOVER_GAP = 8;
const POPOVER_WIDTH = 220;

const ROW_CLASS =
  "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-[var(--color-floating-fg)] hover:bg-[color-mix(in_oklab,var(--color-floating-fg),transparent_86%)] transition-colors";

export default function HouseholdScopePopover() {
  const pathname = usePathname();
  const { households } = useHouseholds();
  const [open, setOpen] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const householdId = pathname.match(/^\/households\/([^/]+)/)?.[1] ?? null;
  const activeHousehold = households.find((h) => h.id === householdId) ?? null;
  const isOnPersonal = !householdId;
  const otherHouseholds = activeHousehold
    ? households.filter((h) => h.id !== activeHousehold.id)
    : households;

  // Close whenever the route changes — tapping a scope link triggers
  // navigation, and we want the popover to dismiss in sync.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click + escape.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Reposition on scroll/resize so the popover stays anchored to the
  // (sticky) trigger even as the page moves underneath.
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.top, left: rect.right + POPOVER_GAP });
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.top, left: rect.right + POPOVER_GAP });
    setOpen(true);
  };

  const popover = (
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={popoverRef}
          role="menu"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={{ duration: 0.14, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
          className={clsx("fixed z-[70] p-1", TOOLTIP_SURFACE_CLASSES)}
        >
          <div className="flex flex-col gap-0.5">
            {!isOnPersonal && (
              <Link href="/dashboard" onClick={() => setOpen(false)} className={ROW_CLASS}>
                <PersonalTile size={20} />
                <span className="truncate">Personal</span>
              </Link>
            )}
            {otherHouseholds.map((h) => (
              <Link
                key={h.id}
                href={`/households/${h.id}/accounts`}
                onClick={() => setOpen(false)}
                className={ROW_CLASS}
              >
                <HouseholdTile household={h} size={20} />
                <span className="truncate">{h.name}</span>
              </Link>
            ))}
            {(otherHouseholds.length > 0 || !isOnPersonal) && (
              <span
                aria-hidden
                className="my-1 mx-2 h-px bg-[color-mix(in_oklab,var(--color-floating-fg),transparent_88%)]"
              />
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowSwitcher(true);
              }}
              className={clsx(
                ROW_CLASS,
                "text-[color-mix(in_oklab,var(--color-floating-fg),transparent_30%)] cursor-pointer",
              )}
            >
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded-md border border-dashed border-[color-mix(in_oklab,var(--color-floating-fg),transparent_60%)]">
                <LuPlus className="h-3 w-3" />
              </span>
              <span>Add household</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-label={`Switch household. Current: ${activeHousehold?.name ?? "Personal"}`}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--color-surface-alt)]/60 transition-colors cursor-pointer"
      >
        <ScopeAvatar household={activeHousehold} size={28} />
      </button>

      {typeof document !== "undefined" && createPortal(popover, document.body)}

      <HouseholdSwitcherModal
        isOpen={showSwitcher}
        onClose={() => setShowSwitcher(false)}
      />
    </>
  );
}
