"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import clsx from "clsx";
import { NAV_GROUPS } from "../nav";
import { isFeatureEnabled } from "../../lib/tierConfigClient";
import SidebarSection from "./SidebarSection";
import SidebarItem from "./SidebarItem";

export default function SidebarContent({ onNavigate, isCollapsed }: { onNavigate?: () => void; isCollapsed?: boolean; toggle?: () => void; showToggle?: boolean }) {
  const pathname = usePathname();

  const groups = useMemo(() => {
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
        return true;
      }),
    })).filter((g) => g.items.length > 0);
  }, []);

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
                  active={pathname.startsWith(it.href)}
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
