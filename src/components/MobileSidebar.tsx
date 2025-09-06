"use client";

import SidebarContent from "./SidebarContent";

export default function MobileSidebar({ onNavigate }: { onNavigate: () => void }) {
  return <SidebarContent onNavigate={onNavigate} />;
}


