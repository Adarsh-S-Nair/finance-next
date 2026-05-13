"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type SettingsNavItem = {
  href: string;
  label: string;
};

type SettingsNavGroup = {
  title?: string;
  items: SettingsNavItem[];
};

const GROUPS: SettingsNavGroup[] = [
  {
    title: "Account",
    items: [
      { href: "/settings/account", label: "Profile" },
      { href: "/settings/subscription", label: "Subscription" },
      { href: "/settings/support-access", label: "Support access" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { href: "/settings/appearance", label: "Appearance" },
      { href: "/settings/agent", label: "Agent" },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/settings/institutions", label: "Institutions" },
      { href: "/settings/categorization", label: "Categorization" },
    ],
  },
  {
    title: "About",
    items: [
      { href: "/settings/legal", label: "Legal" },
    ],
  },
];

const FLAT_ITEMS = GROUPS.flatMap((g) => g.items);

export default function SettingsNav() {
  const pathname = usePathname();

  // /settings (no subsection) defaults to Profile so the first row is
  // highlighted while we're redirecting.
  const activeHref =
    FLAT_ITEMS.find((it) => pathname === it.href || pathname.startsWith(it.href + "/"))?.href ??
    (pathname === "/settings" ? "/settings/account" : null);

  return (
    <>
      {/* Mobile: horizontal scrollable pill row */}
      <nav
        aria-label="Settings sections"
        className="md:hidden -mx-4 px-4 mb-6 overflow-x-auto scrollbar-thin"
      >
        <ul className="flex items-center gap-1 min-w-max">
          {FLAT_ITEMS.map((item) => {
            const isActive = activeHref === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "inline-flex items-center px-3 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-[var(--color-fg)]/[0.08] text-[var(--color-fg)] font-medium"
                      : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: text-only vertical rail, grouped */}
      <nav
        aria-label="Settings sections"
        className="hidden md:block sticky top-6 self-start"
      >
        <ul className="flex flex-col gap-6">
          {GROUPS.map((group) => (
            <li key={group.title ?? group.items[0]?.href}>
              {group.title && (
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]/70 mb-2 px-3">
                  {group.title}
                </div>
              )}
              <ul className="flex flex-col">
                {group.items.map((item) => {
                  const isActive = activeHref === item.href;
                  return (
                    <li key={item.href} className="relative">
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-[var(--color-fg)]"
                        />
                      )}
                      <Link
                        href={item.href}
                        className={clsx(
                          "block py-1.5 pl-3 pr-3 text-[13px] transition-colors",
                          isActive
                            ? "text-[var(--color-fg)] font-medium"
                            : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
