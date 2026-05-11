"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { IconType } from "react-icons";
import {
  LuUser,
  LuCreditCard,
  LuPalette,
  LuSparkles,
  LuBuilding2,
  LuLifeBuoy,
  LuScale,
} from "react-icons/lu";

type SettingsNavItem = {
  href: string;
  label: string;
  icon: IconType;
};

const ITEMS: SettingsNavItem[] = [
  { href: "/settings/account", label: "Account", icon: LuUser },
  { href: "/settings/subscription", label: "Subscription", icon: LuCreditCard },
  { href: "/settings/appearance", label: "Appearance", icon: LuPalette },
  { href: "/settings/agent", label: "Agent", icon: LuSparkles },
  { href: "/settings/institutions", label: "Institutions", icon: LuBuilding2 },
  { href: "/settings/support-access", label: "Support access", icon: LuLifeBuoy },
  { href: "/settings/legal", label: "Legal", icon: LuScale },
];

export default function SettingsNav() {
  const pathname = usePathname();

  // /settings (no subsection) defaults to Account so the first row is
  // highlighted while we're redirecting.
  const activeHref =
    ITEMS.find((it) => pathname === it.href || pathname.startsWith(it.href + "/"))?.href ??
    (pathname === "/settings" ? "/settings/account" : null);

  return (
    <>
      {/* Mobile: horizontal scrollable pill row */}
      <nav
        aria-label="Settings sections"
        className="md:hidden -mx-4 px-4 mb-4 overflow-x-auto scrollbar-thin"
      >
        <ul className="flex items-center gap-1 min-w-max">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeHref === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-[var(--color-fg)]/[0.08] text-[var(--color-fg)] font-medium"
                      : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.04]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: vertical sidebar */}
      <nav
        aria-label="Settings sections"
        className="hidden md:block sticky top-6 self-start"
      >
        <ul className="flex flex-col gap-0.5">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeHref === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-[var(--color-fg)]/[0.06] text-[var(--color-fg)] font-medium"
                      : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.04]",
                  )}
                >
                  <Icon
                    className={clsx(
                      "h-4 w-4 flex-shrink-0",
                      isActive ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
