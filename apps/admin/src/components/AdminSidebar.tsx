"use client";

import { usePathname } from "next/navigation";
import { FiActivity, FiCreditCard, FiHome, FiSettings, FiUsers } from "react-icons/fi";
import { SidebarItem, SidebarSection } from "@zervo/ui";
import BrandMark from "./BrandMark";

const NAV = {
  title: "Admin",
  items: [
    { href: "/", label: "Overview", icon: FiHome },
    { href: "/users", label: "Users", icon: FiUsers },
    { href: "#", label: "Subscriptions", icon: FiCreditCard, disabled: true },
    { href: "#", label: "Audit log", icon: FiActivity, disabled: true },
    { href: "/settings", label: "Settings", icon: FiSettings },
  ],
};

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 bottom-16 w-60 z-50 flex flex-col bg-[var(--color-sidebar-bg)]">
      <div className="flex items-center px-5 py-5">
        <BrandMark />
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-thin pt-3 px-3">
        <SidebarSection label={NAV.title}>
          {NAV.items.map((it) => (
            <SidebarItem
              key={it.label}
              href={it.href}
              label={it.label}
              icon={it.icon}
              disabled={it.disabled}
              active={!it.disabled && (it.href === "/" ? pathname === "/" : pathname.startsWith(it.href))}
            />
          ))}
        </SidebarSection>
      </nav>
    </aside>
  );
}
