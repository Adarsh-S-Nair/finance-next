"use client";

import { usePathname } from "next/navigation";
import { LuTerminal } from "react-icons/lu";
import { FloatingSidebar, type FloatingSidebarNavItem } from "@zervo/ui";
import DeveloperMoreMenu from "./DeveloperMoreMenu";

type Props = {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  initials: string;
};

const NAV_ITEMS: Omit<FloatingSidebarNavItem, "active">[] = [
  { href: "/playground", label: "Playground", icon: LuTerminal },
];

/**
 * Developer portal sidebar. The only signed-in surface is the
 * playground — public reference docs live on zervo.app/docs/api and
 * each playground page links out to its matching doc page.
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
