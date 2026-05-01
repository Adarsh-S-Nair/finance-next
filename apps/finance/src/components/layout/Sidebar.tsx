"use client";

import SidebarContent from "./SidebarContent";

export default function Sidebar({ isCollapsed, toggle, showToggle }: { isCollapsed?: boolean; toggle?: () => void; showToggle?: boolean }) {
  return (
    <aside
      style={{ transition: "width 0.3s ease, left 0.3s ease" }}
      className={`hidden md:flex flex-col fixed top-[var(--impersonation-banner-h,0px)] left-0 bottom-16 z-50 ${isCollapsed ? 'w-20' : 'w-60'}`}
    >
      <SidebarContent isCollapsed={isCollapsed} toggle={toggle} showToggle={showToggle} />
    </aside>
  );
}


