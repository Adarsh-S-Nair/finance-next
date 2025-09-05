"use client";

import ThemeToggle from "./ThemeToggle";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Topbar() {
  const pathname = usePathname();
  const isAuth = pathname.startsWith("/auth");

  return (
    <header className="sticky top-0 z-20 w-full bg-[var(--color-bg)]/70 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-fg)] text-[var(--color-on-primary)]">ƒ</span>
          <span className="font-semibold">Zentari</span>
        </Link>
        <nav className="flex items-center gap-3">
          <ThemeToggle />
          {!isAuth && (
            <Link className="inline-flex rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]" href="/auth">Log in / Sign up</Link>
          )}
        </nav>
      </div>
    </header>
  );
}


