import Link from "next/link";
import { ReactNode } from "react";
import { FiUsers, FiCreditCard, FiActivity, FiHome } from "react-icons/fi";
import { SignOutButton } from "./SignOutButton";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: <FiHome className="h-4 w-4" /> },
  { href: "/users", label: "Users", icon: <FiUsers className="h-4 w-4" /> },
  {
    href: "#",
    label: "Subscriptions",
    icon: <FiCreditCard className="h-4 w-4" />,
    disabled: true,
  },
  {
    href: "#",
    label: "Audit log",
    icon: <FiActivity className="h-4 w-4" />,
    disabled: true,
  },
];

type AdminShellProps = {
  children: ReactNode;
  email?: string | null;
  activePath?: string;
};

export function AdminShell({ children, email, activePath = "/" }: AdminShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--color-content-bg)]">
      <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar-bg)] flex flex-col">
        <div className="px-5 py-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            <span className="text-sm font-semibold text-[var(--color-fg)] tracking-wide">
              ZERVO ADMIN
            </span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = activePath === item.href;
            const base =
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors";
            if (item.disabled) {
              return (
                <span
                  key={item.label}
                  className={`${base} text-[var(--color-muted)]/60 cursor-not-allowed`}
                  aria-disabled
                >
                  {item.icon}
                  <span>{item.label}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-[var(--color-muted)]/50">
                    soon
                  </span>
                </span>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`${base} ${
                  active
                    ? "bg-[var(--color-sidebar-active)] text-[var(--color-fg)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-sidebar-active)]/60"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-[var(--color-border)] flex flex-col gap-2">
          {email && (
            <div className="text-xs text-[var(--color-muted)] truncate" title={email}>
              {email}
            </div>
          )}
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-auto">
        <div className="max-w-6xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
