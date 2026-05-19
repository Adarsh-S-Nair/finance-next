"use client";

import { usePathname } from "next/navigation";
import { LuBookOpen, LuTerminal } from "react-icons/lu";
import { FloatingSidebar, type FloatingSidebarNavItem } from "@zervo/ui";
import DeveloperMoreMenu from "./DeveloperMoreMenu";

type Props = {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  initials: string;
};

const NAV_ITEMS: Omit<FloatingSidebarNavItem, "active">[] = [
  { href: "/docs", label: "Docs", icon: LuBookOpen },
  { href: "/playground", label: "Playground", icon: LuTerminal },
];

/**
 * Developer portal sidebar. /docs is the read-only reference surface,
 * /playground is the interactive try-it surface — same registry, two
 * focused views.
 */
export default function DeveloperSidebar(props: Props) {
  const pathname = usePathname();

  const items: FloatingSidebarNavItem[] = NAV_ITEMS.map((it) => ({
    ...it,
    active: pathname === it.href || pathname.startsWith(`${it.href}/`),
  }));

  return (
    <FloatingSidebar items={items} footer={<DeveloperMoreMenu {...props} />} />
  );
}
