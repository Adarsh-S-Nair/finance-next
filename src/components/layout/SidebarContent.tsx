"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import clsx from "clsx";
import { NAV_GROUPS } from "../nav";
import { isFeatureEnabled } from "../../lib/tierConfigClient";
import SidebarSection from "./SidebarSection";
import SidebarItem from "./SidebarItem";

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

export default function SidebarContent({ onNavigate, isCollapsed }: { onNavigate?: () => void; isCollapsed?: boolean; toggle?: () => void; showToggle?: boolean }) {
  const pathname = usePathname();

  // When the user is inside /households/<id>/* the main nav should route to
  // household-scoped variants so every page stays in that household's context.
  const householdId = useMemo(() => {
    const match = pathname.match(/^\/households\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const groups = useMemo(() => {
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items
        .filter((item) => {
          if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
          // In household scope we only surface a small subset of nav items —
          // no dashboard, transactions, or budgets yet.
          if (householdId && !HOUSEHOLD_ALLOWED_HREFS.has(item.href)) return false;
          return true;
        })
        .map((item) => ({
          ...item,
          personalHref: item.href,
          href: scopedHref(item.href, householdId),
        })),
    })).filter((g) => g.items.length > 0);
  }, [householdId]);

  const isItemActive = (itemHref: string) => pathname.startsWith(itemHref);

  return (
    <div className="flex h-full flex-col bg-[var(--color-sidebar-bg)]">
      <nav className={clsx("flex-1 overflow-y-auto scrollbar-thin pt-5", isCollapsed ? "px-2" : "px-3")}>
        {groups.map((g, i) => (
          <React.Fragment key={g.title ?? `group-${i}`}>
            <SidebarSection label={g.title} isCollapsed={isCollapsed}>
              {g.items.map((it) => (
                <SidebarItem
                  key={it.href}
                  href={it.href}
                  label={it.label}
                  icon={it.icon}
                  active={isItemActive(it.href)}
                  disabled={it.disabled}
                  isCollapsed={isCollapsed}
                  onClick={onNavigate}
                />
              ))}
            </SidebarSection>
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
}
