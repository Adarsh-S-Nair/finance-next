"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { LuSettings } from "react-icons/lu";
import { FloatingSidebar, type FloatingSidebarNavItem } from "@zervo/ui";
import { NAV_GROUPS, type NavItem } from "../nav";
import { isFeatureEnabled } from "../../lib/tierConfig";
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
 * Finance-specific wiring around the shared `<FloatingSidebar>` chrome:
 * household scope popover at the top, more-menu + Settings link at the
 * bottom, and a top inset that clears the impersonation banner when one
 * is shown.
 */
export default function Sidebar() {
  const pathname = usePathname();

  const householdId = useMemo(() => {
    const match = pathname.match(/^\/households\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const items: FloatingSidebarNavItem[] = useMemo(() => {
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
    return flat.map((it) => ({
      href: it.href,
      label: it.label,
      icon: it.icon,
      disabled: it.disabled,
      active: pathname.startsWith(it.href),
    }));
  }, [householdId, pathname]);

  const settingsHref = householdId
    ? `/households/${householdId}/settings`
    : "/settings";

  return (
    <FloatingSidebar
      header={<HouseholdScopePopover />}
      items={items}
      footer={<SidebarMoreMenu />}
      bottomLink={{
        href: settingsHref,
        label: "Settings",
        icon: LuSettings,
        active: pathname.startsWith(settingsHref),
      }}
      topInset="calc(var(--impersonation-banner-h, 0px) + 12px)"
    />
  );
}
