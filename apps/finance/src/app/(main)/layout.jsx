"use client";

import { usePathname } from "next/navigation";
import AppShell from "../../components/layout/AppShell";
import AuthGuard from "../../components/AuthGuard";

export default function MainLayout({ children }) {
  const pathname = usePathname();

  // /setup handles its own auth state (step 0 is pre-auth account creation)
  if (pathname === "/setup") {
    return <AppShell>{children}</AppShell>;
  }

  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
