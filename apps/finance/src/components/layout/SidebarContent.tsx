"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import clsx from "clsx";
import { LuSettings } from "react-icons/lu";
import { NAV_GROUPS, type NavItem } from "../nav";
import { isFeatureEnabled } from "../../lib/tierConfig";
import { SidebarItem, Tooltip } from "@zervo/ui";
import HouseholdScopePopover from "../households/HouseholdScopePopover";
import SidebarMoreMenu from "./SidebarMoreMenu";

// Each SidebarItem (icon-only mode): 18px icon + 8px vertical padding × 2 = 34px.
// `space-y-0.5` (= 2px) inserts gap between rows, so each slot is 36px tall and
// item N starts at y = N * 36 from the top of the <ul>. Hard-coding this is
// cheap and makes the highlight position deterministic, which is the whole
// reason the highlight lives at this level instead of inside SidebarItem.
const ITEM_HEIGHT = 34;
const ITEM_SLOT = 36;
// Distance from the sidebar pill's top to the first nav item's top, summed
// from the chrome above the nav: py-3 (12px) + scope avatar h-11 (44px) +
// pb-2 (8px) + nav pt-1 (4px) = 68px. The accent bar floats at this offset
// (relative to the pill, not the nav) so it can sit flush against the
// pill's left edge without being clipped by nav's overflow.
const NAV_TOP_OFFSET = 68;

/** Subset of personal nav items that are meaningful in household scope. */
const HOUSEHOLD_ALLOWED_HREFS = new Set(["/accounts", "/investments"]);

/**
 * Rewrite a personal nav href into a household-scoped one.
 *   /accounts     → /households/<id>/accounts
 *   /investments  → /households/<id>/investments
 */
function scopedHref(personalHref: string, householdId: string | null): string {
  if (!householdId) return personalHref;
  if (personalHref.startsWith("/")) return `/households/${householdId}${personalHref}`;
  return personalHref;
}

/**
 * Inner contents of the floating sidebar — always icon-only. Renders the
 * scope avatar at the top, the flat list of nav icons in the middle, and
 * the bottom action cluster (more menu + settings) at the bottom.
 */
export default function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const householdId = useMemo(() => {
    const match = pathname.match(/^\/households\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const items = useMemo(() => {
    const flat: (NavItem & { personalHref: string })[] = [];
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) continue;
        if (householdId && !HOUSEHOLD_ALLOWED_HREFS.has(item.href)) continue;
        flat.push({
          ...item,
          personalHref: item.href,
          href: scopedHref(item.href, householdId),
        });
      }
    }
    return flat;
  }, [householdId]);

  const settingsHref = householdId
    ? `/households/${householdId}/settings`
    : "/settings";

  const isItemActive = (itemHref: string) => pathname.startsWith(itemHref);
  const activeIndex = items.findIndex((it) => isItemActive(it.href));
  // Settings is at the bottom of the sidebar in its own area, so it gets
  // its own accent bar anchored to the bottom of the pill rather than
  // sharing the nav indicator's index-driven top offset.
  const isSettingsActive = pathname.startsWith(settingsHref);

  return (
    <div className="relative flex h-full w-full flex-col py-3 rounded-[20px] bg-[var(--color-bg)] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-3px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Active accent bar — pinned to the sidebar pill's left edge,
          sits outside `nav` so it isn't clipped by overflow and so it
          can sit flush against the pill instead of inset by nav's
          horizontal padding. */}
      {activeIndex >= 0 && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-0 w-[3px] bg-[var(--color-fg)]"
          style={{ height: ITEM_HEIGHT, top: 0 }}
          initial={false}
          animate={{ y: NAV_TOP_OFFSET + activeIndex * ITEM_SLOT }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        />
      )}

      {/* Settings active accent bar — anchored to the bottom of the pill
          so the bar follows the settings button regardless of viewport
          height. py-3 (12) is the pill's bottom padding; h-10 (40) is
          the settings button. */}
      {isSettingsActive && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 w-[3px] bg-[var(--color-fg)]"
          style={{ height: 40, bottom: 12 }}
        />
      )}

      <div className="flex justify-center pb-2">
        <HouseholdScopePopover />
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin pt-1">
        <ul className="space-y-0.5">
          {items.map((it) => (
            <SidebarItem
              key={it.href}
              href={it.href}
              label={it.label}
              icon={it.icon}
              active={isItemActive(it.href)}
              disabled={it.disabled}
              isCollapsed
              externalActiveHighlight
              onClick={onNavigate}
            />
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-0.5 pt-2">
        <SidebarMoreMenu />
        <Tooltip content="Settings" side="right">
          <Link
            href={settingsHref}
            onClick={onNavigate}
            aria-label="Settings"
            className={clsx(
              "flex items-center justify-center w-full h-10 transition-colors",
              isSettingsActive
                ? "text-[var(--color-fg)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
            )}
          >
            <LuSettings className="h-[18px] w-[18px]" />
          </Link>
        </Tooltip>
      </div>
    </div>
  );
}
