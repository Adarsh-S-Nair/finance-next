"use client";

import SidebarContent from "./SidebarContent";

/**
 * Floating, icon-only sidebar pinned to the left edge. Spans top to bottom
 * with a small inset, rounded corners, and a soft border so it reads as a
 * navigation island floating above the shell. Mobile (`md:hidden`) uses
 * the drawer in MobileNavMenu instead.
 */
export default function Sidebar() {
  return (
    <aside
      className="hidden md:block fixed left-3 w-14 z-50"
      style={{
        top: "calc(var(--impersonation-banner-h, 0px) + 12px)",
        bottom: "12px",
      }}
    >
      <SidebarContent />
    </aside>
  );
}
