"use client";

import SidebarContent from "./SidebarContent";

export default function Sidebar({ isCollapsed, toggle, showToggle }: { isCollapsed?: boolean; toggle?: () => void; showToggle?: boolean }) {
  return (
    <aside
      className={`hidden md:flex flex-col fixed top-0 left-0 h-screen z-50 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'
        }`}
    >
      <SidebarContent isCollapsed={isCollapsed} toggle={toggle} showToggle={showToggle} />
    </aside>
  );
}


