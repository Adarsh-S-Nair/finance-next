"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LuSettings } from "react-icons/lu";
import { NAV_GROUPS, type NavItem } from "../nav";
import { isFeatureEnabled } from "../../lib/tierConfig";
import { SidebarItem, Tooltip } from "@zervo/ui";
import HouseholdScopePopover from "../households/HouseholdScopePopover";
import SidebarMoreMenu from "./SidebarMoreMenu";

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

  return (
    <div className="flex h-full w-full flex-col py-3">
      <div className="flex justify-center pb-2">
        <HouseholdScopePopover />
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pt-1">
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
              onClick={onNavigate}
            />
          ))}
        </ul>
      </nav>

      <div className="flex flex-col items-center gap-1 px-2 pt-2">
        <SidebarMoreMenu />
        <Tooltip content="Settings" side="right">
          <Link
            href={settingsHref}
            onClick={onNavigate}
            aria-label="Settings"
            className={clsx(
              "flex items-center justify-center w-10 h-10 rounded-md transition-colors",
              pathname.startsWith("/settings")
                ? "text-[var(--color-fg)] bg-[var(--color-fg)]/[0.08]"
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
