"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { LuChevronDown, LuPlus } from "react-icons/lu";
import { useHouseholds } from "../providers/HouseholdsProvider";
import HouseholdSwitcherModal from "./HouseholdSwitcherModal";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Compact household picker intended for mobile + tablet screens where the
 * full rail isn't visible. Renders a pill in the topbar showing the current
 * scope; tapping opens a slide-down panel with Personal + every household +
 * Create/Join.
 */
export default function HouseholdPicker() {
  const pathname = usePathname();
  const { households } = useHouseholds();
  const [open, setOpen] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const householdId = (() => {
    const match = pathname.match(/^\/households\/([^/]+)/);
    return match?.[1] ?? null;
  })();
  const activeHousehold = households.find((h) => h.id === householdId) ?? null;
  const onPersonal = !householdId;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const currentLabel = activeHousehold ? activeHousehold.name : "Personal";
  const currentDot = activeHousehold ? (
    <span
      className="block h-2.5 w-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: activeHousehold.color }}
      aria-hidden
    />
  ) : (
    <span
      aria-hidden
      className="block h-3 w-3 bg-[var(--color-fg)] flex-shrink-0"
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

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            "flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer",
            "text-[var(--color-fg)] bg-[var(--color-fg)]/[0.05] hover:bg-[var(--color-fg)]/[0.08]",
            open && "bg-[var(--color-fg)]/[0.08]",
          )}
        >
          {currentDot}
          <span className="truncate max-w-[160px]">{currentLabel}</span>
          <LuChevronDown
            className={clsx("h-3.5 w-3.5 text-[var(--color-muted)] transition-transform", open && "rotate-180")}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.14, ease: [0.25, 0.1, 0.25, 1] }}
              role="menu"
              className={clsx(
                "absolute left-0 top-[calc(100%+8px)] z-[60]",
                "w-64 p-1 rounded-xl bg-[var(--color-surface-alt)] ring-1 ring-[var(--color-fg)]/[0.08] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]",
              )}
            >
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex w-full items-center gap-3 px-2.5 py-2 rounded-md text-[13px] transition-colors",
                  onPersonal
                    ? "text-[var(--color-fg)] font-medium bg-[var(--color-fg)]/[0.06]"
                    : "text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
                )}
              >
                <span
                  aria-hidden
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-fg)]/[0.05]"
                >
                  <span
                    aria-hidden
                    className="block h-4 w-4 bg-[var(--color-fg)]"
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
                </span>
                <span className="flex-1 truncate">Personal</span>
              </Link>

              {households.length > 0 && (
                <div className="my-1 h-px mx-2 bg-[var(--color-fg)]/[0.06]" />
              )}

              {households.map((h) => {
                const isActive = h.id === householdId;
                return (
                  <Link
                    key={h.id}
                    href={`/households/${h.id}/accounts`}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "flex w-full items-center gap-3 px-2.5 py-2 rounded-md text-[13px] transition-colors",
                      isActive
                        ? "text-[var(--color-fg)] font-medium bg-[var(--color-fg)]/[0.06]"
                        : "text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
                    )}
                  >
                    <span
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: h.color }}
                    >
                      {initialsFor(h.name)}
                    </span>
                    <span className="flex-1 truncate">{h.name}</span>
                  </Link>
                );
              })}

              <div className="my-1 h-px mx-2 bg-[var(--color-fg)]/[0.06]" />

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowSwitcher(true);
                }}
                className="flex w-full items-center gap-3 px-2.5 py-2 rounded-md text-[13px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05] transition-colors cursor-pointer"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--color-border)]">
                  <LuPlus className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-left">Create or join</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <HouseholdSwitcherModal isOpen={showSwitcher} onClose={() => setShowSwitcher(false)} />
    </>
  );
}
