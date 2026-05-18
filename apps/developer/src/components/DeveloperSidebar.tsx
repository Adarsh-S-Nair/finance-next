"use client";

import { usePathname } from "next/navigation";
import {
  FiActivity,
  FiBookOpen,
  FiHome,
  FiKey,
  FiSettings,
  FiZap,
} from "react-icons/fi";
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
  { href: "/keys", label: "API keys", icon: FiKey, disabled: true },
  { href: "/endpoints", label: "Endpoints", icon: FiZap, disabled: true },
  { href: "/usage", label: "Usage", icon: FiActivity, disabled: true },
  { href: "/docs", label: "Docs", icon: FiBookOpen, disabled: true },
];

/**
 * Developer portal sidebar — same FloatingSidebar chrome as finance and
 * admin so navigation feels identical across surfaces. Most items are
 * disabled placeholders until the corresponding feature ships.
 */
export default function DeveloperSidebar(props: Props) {
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
      footer={<DeveloperMoreMenu {...props} />}
      bottomLink={{
        href: "/settings",
        label: "Settings",
        icon: FiSettings,
        active: pathname.startsWith("/settings"),
      }}
    />
  );
}
