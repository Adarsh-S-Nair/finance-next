"use client";

import React from "react";

interface SidebarSectionProps {
  label?: string;
  isCollapsed?: boolean;
  children: React.ReactNode;
}

export default function SidebarSection({
  label,
  isCollapsed = false,
  children,
}: SidebarSectionProps) {
  return (
    <div className={isCollapsed ? "mb-1" : "mb-1"}>
      {!isCollapsed && label && (
        <div className="px-3 mb-1.5 mt-4 first:mt-0">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/40 select-none">
            {label}
          </span>
        </div>
      )}
      {isCollapsed && label && <div className="mx-3 my-2 border-t border-[var(--color-fg)]/[0.06]" />}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
