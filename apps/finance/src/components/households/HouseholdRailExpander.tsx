"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import clsx from "clsx";
import { LuChevronDown, LuPlus } from "react-icons/lu";
import { useHouseholds } from "../providers/HouseholdsProvider";
import HouseholdSwitcherModal from "./HouseholdSwitcherModal";
import { HouseholdAvatarStack } from "./HouseholdAvatarStack";

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

  // Desktop (xl+) has its own permanent rail — no panel needed there. If the
  // user opened the panel on a smaller viewport and then resized up, force it
  // closed so the shell doesn't stay shifted down.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1280px)");
    const onChange = () => {
      if (mql.matches) setExpanded(false);
    };
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

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
 * Minimal mobile trigger. No bubble, no background — just the Zervo logo on
 * personal or the household name on a household, centered in the topbar.
 * Tapping still toggles the rail.
 */
export function HouseholdRailInlineTrigger() {
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
      aria-label={`Switch household. Current: ${label}`}
      className="flex items-center gap-2 px-2 py-1 cursor-pointer group"
    >
      {activeHousehold ? (
        <span className="text-sm font-medium text-[var(--color-fg)] truncate max-w-[200px]">
          {activeHousehold.name}
        </span>
      ) : (
        <ZervoMark className="h-8 w-8" />
      )}
      <LuChevronDown
        className={clsx(
          "h-3.5 w-3.5 text-[var(--color-muted)]/60 transition-transform group-hover:text-[var(--color-muted)]",
          expanded && "rotate-180",
        )}
      />
    </button>
  );
}

/**
 * Bubble trigger for the mobile topbar + tablet sidebar. Always renders the
 * active styling of the current scope — personal uses the accent bubble
 * with inverted Zervo, household uses its color. This matches how the
 * desktop rail draws the active scope, so the same route looks the same
 * wherever the switcher lives.
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
      className="group relative flex h-11 w-11 items-center justify-center cursor-pointer"
    >
      <span
        className={clsx(
          "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl",
          !activeHousehold && "bg-[var(--color-accent)]",
        )}
        style={
          activeHousehold
            ? {
                backgroundColor: `color-mix(in oklab, ${activeHousehold.color}, transparent 80%)`,
              }
            : undefined
        }
      >
        {activeHousehold ? (
          <HouseholdAvatarStack
            members={activeHousehold.members}
            totalMembers={activeHousehold.member_count}
            size={40}
            fallbackName={activeHousehold.name}
            fallbackColor={activeHousehold.color}
          />
        ) : (
          <ZervoMark inverted className="h-7 w-7" />
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
        className="fixed top-0 left-0 right-0 z-[55] xl:hidden bg-[var(--color-surface-alt)]"
      >
        {/* Mobile-only: soft gradient at the bottom of the rail that hints
            the main app above is casting a shadow onto the rail. Kept very
            light so it doesn't look like a dark band in light mode. */}
        <div
          aria-hidden
          className="md:hidden pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/15 to-transparent"
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
                    "flex h-12 w-12 items-center justify-center overflow-hidden transition-[border-radius,background-color,color] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
                    onPersonal
                      ? "rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent,white)]"
                      : "rounded-[24px] bg-[var(--color-fg)]/[0.06] text-[var(--color-fg)] group-hover:rounded-xl",
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
                        "flex h-12 w-12 items-center justify-center overflow-hidden transition-[border-radius,background-color] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
                        active
                          ? "rounded-xl"
                          : "rounded-[24px] group-hover:rounded-xl",
                      )}
                      style={{
                        backgroundColor: active
                          ? `color-mix(in oklab, ${h.color}, transparent 80%)`
                          : "transparent",
                      }}
                    >
                      <HouseholdAvatarStack
                        members={h.members}
                        totalMembers={h.member_count}
                        size={44}
                        fallbackName={h.name}
                        fallbackColor={h.color}
                      />
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
                <span className="flex h-12 w-12 items-center justify-center rounded-[24px] border border-dashed border-[var(--color-border)] text-[var(--color-muted)] transition-[border-radius,background-color,color,border-color] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:rounded-xl group-hover:border-solid group-hover:border-[var(--color-accent)] group-hover:bg-[var(--color-accent)]/10 group-hover:text-[var(--color-accent)]">
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
