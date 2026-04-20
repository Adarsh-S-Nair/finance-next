"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { LuChevronDown, LuPlus } from "react-icons/lu";
import { useHouseholds } from "../providers/HouseholdsProvider";
import HouseholdSwitcherModal from "./HouseholdSwitcherModal";

const PORTAL_ID = "tablet-household-rail-portal";

type Ctx = {
  expanded: boolean;
  toggle: () => void;
  close: () => void;
};

const TabletHouseholdRailContext = createContext<Ctx>({
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

function ZervoMark({ inverted }: { inverted?: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "block h-5 w-5",
        inverted ? "bg-[var(--color-on-accent,white)]" : "bg-[var(--color-fg)]",
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
 * Shell-level provider. AppShell wraps its subtree so the sidebar trigger
 * and the expandable panel (rendered via portal) share the same open state.
 */
export function TabletHouseholdRailProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

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
    <TabletHouseholdRailContext.Provider value={value}>
      {children}
    </TabletHouseholdRailContext.Provider>
  );
}

/**
 * Compact trigger that lives at the top of the collapsed sidebar. Mirrors
 * the current scope: Zervo mark when personal, household color + initial
 * when on a household.
 */
export function TabletHouseholdRailTrigger() {
  const pathname = usePathname();
  const { households } = useHouseholds();
  const { expanded, toggle } = useContext(TabletHouseholdRailContext);

  const householdId = pathname.match(/^\/households\/([^/]+)/)?.[1] ?? null;
  const activeHousehold = households.find((h) => h.id === householdId) ?? null;

  const label = activeHousehold ? activeHousehold.name : "Personal";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch household. Current: ${label}`}
      aria-expanded={expanded}
      className="group relative flex h-11 w-11 items-center justify-center transition-transform"
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
          <ZervoMark inverted={expanded} />
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
 * The expandable horizontal rail. Rendered via portal into the
 * #tablet-household-rail-portal target (placed in AppShell between the
 * topbar and the page content), so when the height animates from 0 to
 * auto, the content below naturally pushes down.
 */
export function TabletHouseholdRailPanel() {
  const pathname = usePathname();
  const { households } = useHouseholds();
  const { expanded, close } = useContext(TabletHouseholdRailContext);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const householdId = pathname.match(/^\/households\/([^/]+)/)?.[1] ?? null;
  const onPersonal = !householdId;

  const portalTarget = mounted ? document.getElementById(PORTAL_ID) : null;

  const handleSwitcherOpen = useCallback(() => {
    close();
    setShowSwitcher(true);
  }, [close]);

  if (!portalTarget) {
    return (
      <HouseholdSwitcherModal isOpen={showSwitcher} onClose={() => setShowSwitcher(false)} />
    );
  }

  const content = (
    <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          key="tablet-rail-panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          className="overflow-hidden border-b border-[var(--color-fg)]/[0.06] bg-[var(--color-surface-alt)]"
        >
          <div className="mx-auto max-w-[1440px] px-4 md:px-6 lg:px-10 py-4">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-thin">
              {/* Personal */}
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
                  <ZervoMark inverted={onPersonal} />
                </span>
                <span
                  className={clsx(
                    "text-[11px] truncate max-w-[64px]",
                    onPersonal ? "text-[var(--color-fg)] font-medium" : "text-[var(--color-muted)]",
                  )}
                >
                  Personal
                </span>
              </Link>

              {households.length > 0 && (
                <span
                  aria-hidden
                  className="h-8 w-px bg-[var(--color-fg)]/[0.08] flex-shrink-0 mx-1"
                />
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
                        "text-[11px] truncate max-w-[64px]",
                        active ? "text-[var(--color-fg)] font-medium" : "text-[var(--color-muted)]",
                      )}
                    >
                      {h.name}
                    </span>
                  </Link>
                );
              })}

              {/* Create or join */}
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {createPortal(content, portalTarget)}
      <HouseholdSwitcherModal isOpen={showSwitcher} onClose={() => setShowSwitcher(false)} />
    </>
  );
}

export const TABLET_HOUSEHOLD_RAIL_PORTAL_ID = PORTAL_ID;
