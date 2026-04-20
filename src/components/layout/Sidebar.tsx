"use client";

import SidebarContent from "./SidebarContent";

export default function Sidebar({ isCollapsed, toggle, showToggle }: { isCollapsed?: boolean; toggle?: () => void; showToggle?: boolean }) {
  return (
    <aside
      style={{ top: "var(--rail-offset, 0px)", transition: "top 0.22s cubic-bezier(0.25, 0.1, 0.25, 1), width 0.3s ease, left 0.3s ease" }}
      className={`hidden md:flex flex-col fixed left-0 xl:left-20 bottom-16 z-50 ${isCollapsed ? 'w-20' : 'w-60'}`}
    >
      <SidebarContent isCollapsed={isCollapsed} toggle={toggle} showToggle={showToggle} />
    </aside>
  );
}


