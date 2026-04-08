"use client";

import React from "react";

interface SidebarSectionProps {
  label: string;
  isCollapsed?: boolean;
  children: React.ReactNode;
}

export default function SidebarSection({
  label,
  isCollapsed = false,
  children,
}: SidebarSectionProps) {
  return (
    <div className={isCollapsed ? "mb-4" : "mb-5"}>
      {!isCollapsed && (
        <div className="px-3 mb-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/50 select-none">
            {label}
          </span>
        </div>
      )}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
