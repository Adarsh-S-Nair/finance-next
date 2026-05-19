"use client";

import { usePathname } from "next/navigation";
import { FiHome } from "react-icons/fi";
import { FloatingSidebar, type FloatingSidebarNavItem } from "@zervo/ui";
import DeveloperMoreMenu from "./DeveloperMoreMenu";

type Props = {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  initials: string;
};

const NAV_ITEMS: Omit<FloatingSidebarNavItem, "active">[] = [
  { href: "/", label: "Overview", icon: FiHome },
];

/**
 * Developer portal sidebar — same FloatingSidebar chrome as finance and
 * admin. Bare-bones for now (just Overview); more items get added once
 * we actually have features to show.
 */
export default function DeveloperSidebar(props: Props) {
  const pathname = usePathname();

  const items: FloatingSidebarNavItem[] = NAV_ITEMS.map((it) => ({
    ...it,
    active: it.href === "/" ? pathname === "/" : pathname.startsWith(it.href),
  }));

  return (
    <FloatingSidebar items={items} footer={<DeveloperMoreMenu {...props} />} />
  );
}
