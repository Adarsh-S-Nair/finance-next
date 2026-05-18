"use client";

import { usePathname } from "next/navigation";
import {
  FiActivity,
  FiCpu,
  FiCreditCard,
  FiHome,
  FiSettings,
  FiUsers,
} from "react-icons/fi";
import { FloatingSidebar, type FloatingSidebarNavItem } from "@zervo/ui";
import AdminMoreMenu from "./AdminMoreMenu";

type Props = {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  initials: string;
};

const NAV_ITEMS: Omit<FloatingSidebarNavItem, "active">[] = [
  { href: "/", label: "Overview", icon: FiHome },
  { href: "/users", label: "Users", icon: FiUsers },
  { href: "/settings/agent", label: "Agent", icon: FiCpu },
  { href: "#", label: "Subscriptions", icon: FiCreditCard, disabled: true },
  { href: "#", label: "Audit log", icon: FiActivity, disabled: true },
];

/**
 * Admin uses the shared floating sidebar so navigation matches finance.
 * The bottom more-menu carries identity + theme toggle + sign-out (admin
 * has no household scope to put up top).
 */
export default function AdminSidebar(props: Props) {
  const pathname = usePathname();

  const items: FloatingSidebarNavItem[] = NAV_ITEMS.map((it) => ({
    ...it,
    active:
      !it.disabled &&
      (it.href === "/" ? pathname === "/" : pathname.startsWith(it.href)),
  }));

  return (
    <FloatingSidebar
      items={items}
      footer={<AdminMoreMenu {...props} />}
      bottomLink={{
        href: "/settings",
        label: "Settings",
        icon: FiSettings,
        active: pathname === "/settings",
      }}
    />
  );
}
