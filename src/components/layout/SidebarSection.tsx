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
    <div className={isCollapsed ? "mb-3" : "mb-3"}>
      <div className={`rounded-xl ${label ? "bg-[var(--color-fg)]/[0.02] border border-[var(--color-fg)]/[0.04]" : ""} ${isCollapsed ? "p-1" : label ? "px-1.5 py-2" : "px-1.5"}`}>
        {!isCollapsed && label && (
          <div className="px-2 mb-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/50 select-none">
              {label}
            </span>
          </div>
        )}
        <ul className="space-y-0.5">{children}</ul>
      </div>
    </div>
  );
}
