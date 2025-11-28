"use client";

import SidebarContent from "./SidebarContent";

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-60 xl:w-64 fixed top-0 left-0 h-screen z-10">
      <SidebarContent />
    </aside>
  );
}


