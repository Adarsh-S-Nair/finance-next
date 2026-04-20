"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import clsx from "clsx";
import { LuChevronDown, LuPlus } from "react-icons/lu";
import { useHouseholds } from "../providers/HouseholdsProvider";
import HouseholdSwitcherModal from "./HouseholdSwitcherModal";

/**
 * Height of the open rail, in pixels. The same value is used for the panel's
 * height animation and as the offset applied to every top-anchored fixed
 * element (topbar, sidebar, rail) so they all slide down in sync.
 */
export const HOUSEHOLD_RAIL_HEIGHT = 112;

type Ctx = {
  expanded: boolean;
  toggle: () => void;
  close: () => void;
};

const HouseholdRailContext = createContext<Ctx>({
  expanded: false,
  toggle: () => { },
  close: () => { },
});

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ZervoMark({ inverted, className = "" }: { inverted?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "block",
        inverted ? "bg-[var(--color-on-accent,white)]" : "bg-[var(--color-fg)]",
        className,
      )}
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

/**
 * Shell-level provider. Exposes expand state to the trigger(s) and the panel
 * so multiple triggers (sidebar bubble on tablet, topbar pill on mobile) and
 * a single panel stay in sync. Also writes --rail-offset on document.body
 * so every top-anchored fixed element in the shell slides down with the
 * same animation.
 */
export function HouseholdRailProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.setProperty("--rail-offset", expanded ? `${HOUSEHOLD_RAIL_HEIGHT}px` : "0px");
    return () => {
      document.body.style.setProperty("--rail-offset", "0px");
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  const value = useMemo<Ctx>(
    () => ({
      expanded,
      toggle: () => setExpanded((v) => !v),
      close: () => setExpanded(false),
    }),
    [expanded],
  );

  return (
    <HouseholdRailContext.Provider value={value}>
      {children}
    </HouseholdRailContext.Provider>
  );
}

export function useHouseholdRail() {
  return useContext(HouseholdRailContext);
}

/**
 * Bubble trigger for the tablet sidebar. Mirrors the current scope.
 */
export function HouseholdRailBubbleTrigger() {
  const pathname = usePathname();
  const { households } = useHouseholds();
  const { expanded, toggle } = useHouseholdRail();

  const householdId = pathname.match(/^\/households\/([^/]+)/)?.[1] ?? null;
  const activeHousehold = households.find((h) => h.id === householdId) ?? null;

  const label = activeHousehold ? activeHousehold.name : "Personal";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch household. Current: ${label}`}
      aria-expanded={expanded}
      className="group relative flex h-11 w-11 items-center justify-center transition-transform cursor-pointer"
    >
      <span
        className={clsx(
          "flex h-11 w-11 items-center justify-center overflow-hidden text-sm font-semibold transition-all duration-200",
          activeHousehold
            ? "rounded-xl text-white"
            : expanded
              ? "rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent,white)]"
              : "rounded-full bg-[var(--color-surface-alt)] text-[var(--color-fg)]",
        )}
        style={activeHousehold ? { backgroundColor: activeHousehold.color } : undefined}
      >
        {activeHousehold ? (
          <span>{initialsFor(activeHousehold.name)}</span>
        ) : (
          <ZervoMark inverted={expanded} className="h-7 w-7" />
        )}
      </span>
      <LuChevronDown
        className={clsx(
          "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[var(--color-sidebar-bg)] p-0.5 text-[var(--color-muted)] transition-transform",
          expanded && "rotate-180",
        )}
      />
    </button>
  );
}

/**
 * Compact pill trigger for the mobile topbar — kept as an export for places
 * that still want a labelled trigger, but the default mobile trigger is the
 * bubble (HouseholdRailBubbleTrigger) for consistency with tablet.
 */
export function HouseholdRailPillTrigger() {
  const pathname = usePathname();
  const { households } = useHouseholds();
  const { expanded, toggle } = useHouseholdRail();

  const householdId = pathname.match(/^\/households\/([^/]+)/)?.[1] ?? null;
  const activeHousehold = households.find((h) => h.id === householdId) ?? null;
  const label = activeHousehold ? activeHousehold.name : "Personal";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={expanded}
      className={clsx(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer",
        "text-[var(--color-fg)] bg-[var(--color-fg)]/[0.05] hover:bg-[var(--color-fg)]/[0.08]",
        expanded && "bg-[var(--color-fg)]/[0.08]",
      )}
    >
      <span className="truncate max-w-[140px]">{label}</span>
      <LuChevronDown
        className={clsx("h-3.5 w-3.5 text-[var(--color-muted)] transition-transform", expanded && "rotate-180")}
      />
    </button>
  );
}

/**
 * The expandable horizontal rail. Pinned to top:0 above every other shell
 * element so when its height animates from 0 to HOUSEHOLD_RAIL_HEIGHT the
 * app (topbar, sidebar, desktop rail) slides down via --rail-offset.
 */
export function HouseholdRailPanel() {
  const pathname = usePathname();
  const { households } = useHouseholds();
  const { expanded, close } = useHouseholdRail();
  const [showSwitcher, setShowSwitcher] = useState(false);

  const householdId = pathname.match(/^\/households\/([^/]+)/)?.[1] ?? null;
  const onPersonal = !householdId;

  const handleSwitcherOpen = useCallback(() => {
    close();
    setShowSwitcher(true);
  }, [close]);

  return (
    <>
      {/* Panel has a fixed height and translates into/out of view — cheaper
          than animating height, which would trigger layout. */}
      <motion.div
        aria-hidden={!expanded}
        initial={false}
        animate={{ y: expanded ? 0 : -HOUSEHOLD_RAIL_HEIGHT }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ height: HOUSEHOLD_RAIL_HEIGHT, willChange: "transform" }}
        className="fixed top-0 left-0 right-0 z-[55] bg-[var(--color-surface-alt)] border-b border-[var(--color-fg)]/[0.06]"
      >
        {/* Mobile-only: a gradient at the bottom of the rail that makes the
            main app above look like it's casting a shadow onto the rail
            we just slid down to reveal. */}
        <div
          aria-hidden
          className="md:hidden pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/25 to-transparent"
        />
        <div className="h-full flex items-center overflow-x-auto scrollbar-thin px-4 md:px-6 lg:px-10 gap-3">
              <Link
                href="/dashboard"
                onClick={close}
                className="group flex flex-col items-center gap-1.5 flex-shrink-0"
                aria-label="Personal"
              >
                <span
                  className={clsx(
                    "flex h-12 w-12 items-center justify-center overflow-hidden transition-all duration-200",
                    onPersonal
                      ? "rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent,white)]"
                      : "rounded-full bg-[var(--color-fg)]/[0.06] text-[var(--color-fg)] group-hover:rounded-xl",
                  )}
                >
                  <ZervoMark inverted={onPersonal} className="h-7 w-7" />
                </span>
                <span
                  className={clsx(
                    "text-[11px] truncate max-w-[72px]",
                    onPersonal ? "text-[var(--color-fg)] font-medium" : "text-[var(--color-muted)]",
                  )}
                >
                  Personal
                </span>
              </Link>

              {households.length > 0 && (
                <span aria-hidden className="h-8 w-px bg-[var(--color-fg)]/[0.08] flex-shrink-0 mx-1" />
              )}

              {households.map((h) => {
                const active = h.id === householdId;
                return (
                  <Link
                    key={h.id}
                    href={`/households/${h.id}/accounts`}
                    onClick={close}
                    className="group flex flex-col items-center gap-1.5 flex-shrink-0"
                    aria-label={h.name}
                  >
                    <span
                      className={clsx(
                        "flex h-12 w-12 items-center justify-center overflow-hidden text-sm font-semibold text-white transition-all duration-200",
                        active ? "rounded-xl" : "rounded-full group-hover:rounded-xl",
                      )}
                      style={{ backgroundColor: h.color }}
                    >
                      {initialsFor(h.name)}
                    </span>
                    <span
                      className={clsx(
                        "text-[11px] truncate max-w-[72px]",
                        active ? "text-[var(--color-fg)] font-medium" : "text-[var(--color-muted)]",
                      )}
                    >
                      {h.name}
                    </span>
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={handleSwitcherOpen}
                className="group flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
                aria-label="Create or join a household"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-muted)] transition-all duration-200 group-hover:rounded-xl group-hover:border-solid group-hover:border-[var(--color-accent)] group-hover:bg-[var(--color-accent)]/10 group-hover:text-[var(--color-accent)]">
                  <LuPlus className="h-5 w-5" />
                </span>
                <span className="text-[11px] text-[var(--color-muted)]">Add</span>
              </button>
        </div>
      </motion.div>

      <HouseholdSwitcherModal isOpen={showSwitcher} onClose={() => setShowSwitcher(false)} />
    </>
  );
}
