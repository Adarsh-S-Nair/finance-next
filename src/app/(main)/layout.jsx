"use client";

import AppShell from "../../components/AppShell";
import AuthGuard from "../../components/AuthGuard";

export default function MainLayout({ children }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
