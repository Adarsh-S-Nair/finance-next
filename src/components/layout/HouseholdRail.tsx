"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LuPlus } from "react-icons/lu";
import { Tooltip } from "@slate-ui/react";
import { useHouseholds } from "../providers/HouseholdsProvider";
import HouseholdSwitcherModal from "../households/HouseholdSwitcherModal";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The Discord-style active indicator: a short vertical bar on the left edge
 * that grows when active and collapses when not.
 */
function ActiveIndicator({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-fg)] transition-all duration-200",
        active ? "opacity-100" : "opacity-0 group-hover:opacity-60 group-hover:h-3",
      )}
    />
  );
}

function ZervoMark({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "block h-7 w-7 transition-colors",
        active ? "bg-[var(--color-on-accent,white)]" : "bg-[var(--color-fg)]",
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

type BubbleProps = {
  active?: boolean;
  children: React.ReactNode;
};

function Bubble({ active = false, children }: BubbleProps) {
  return (
    <span
      className={clsx(
        "flex h-11 w-11 items-center justify-center overflow-hidden text-sm font-semibold transition-all duration-200",
        active
          ? "rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent,white)]"
          : "rounded-full bg-[var(--color-surface-alt)] text-[var(--color-fg)] group-hover:rounded-xl group-hover:bg-[var(--color-accent)] group-hover:text-[var(--color-on-accent,white)]",
      )}
    >
      {children}
    </span>
  );
}

export default function HouseholdRail() {
  const pathname = usePathname();
  const { households } = useHouseholds();
  const [showSwitcher, setShowSwitcher] = useState(false);

  const isOnHousehold = pathname.startsWith("/households/");
  const activeHouseholdId = isOnHousehold
    ? pathname.match(/^\/households\/([^/]+)/)?.[1] ?? null
    : null;

  return (
    <>
      <aside
        className={clsx(
          "hidden md:flex flex-col fixed top-0 left-0 bottom-20 w-20 z-50",
          "border-r border-[var(--color-fg)]/[0.06] bg-[var(--color-content-bg)]",
        )}
      >
        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto scrollbar-thin pt-5 pb-3">
          {/* Personal — Zervo logo */}
          <Tooltip content="Personal">
            <Link
              href="/dashboard"
              className="group relative flex h-11 w-full items-center justify-center"
              aria-label="Personal"
            >
              <ActiveIndicator active={!isOnHousehold} />
              <Bubble active={!isOnHousehold}>
                <ZervoMark active={!isOnHousehold} />
              </Bubble>
            </Link>
          </Tooltip>

          {/* Divider between personal and households */}
          <div className="mx-auto my-1 h-px w-8 bg-[var(--color-fg)]/[0.08]" />

          {/* Households */}
          {households.map((h) => {
            const active = h.id === activeHouseholdId;
            return (
              <Tooltip key={h.id} content={h.name}>
                <Link
                  href={`/households/${h.id}`}
                  className="group relative flex h-11 w-full items-center justify-center"
                  aria-label={h.name}
                >
                  <ActiveIndicator active={active} />
                  <Bubble active={active}>
                    <span>{initialsFor(h.name)}</span>
                  </Bubble>
                </Link>
              </Tooltip>
            );
          })}

          {/* Add-household circle */}
          <Tooltip content="Create or join a household">
            <button
              onClick={() => setShowSwitcher(true)}
              className="group relative flex h-11 w-full items-center justify-center"
              aria-label="Create or join a household"
            >
              <span
                className={clsx(
                  "flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-muted)] transition-all duration-200",
                  "group-hover:rounded-xl group-hover:border-solid group-hover:border-[var(--color-accent)] group-hover:bg-[var(--color-accent)]/10 group-hover:text-[var(--color-accent)]",
                )}
              >
                <LuPlus className="h-5 w-5" />
              </span>
            </button>
          </Tooltip>
        </nav>
      </aside>

      <HouseholdSwitcherModal
        isOpen={showSwitcher}
        onClose={() => setShowSwitcher(false)}
      />
    </>
  );
}
