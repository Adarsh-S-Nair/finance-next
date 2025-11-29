"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { LuMenu } from "react-icons/lu";
import DebugMemoryStats from "./DebugMemoryStats";

export default function AppTopbar() {
  const pathname = usePathname();
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) return;

      // Original profile logic
      const first = (user.user_metadata?.first_name as string | undefined) || "";
      const last = (user.user_metadata?.last_name as string | undefined) || "";
      const composite = `${first} ${last}`.trim();
      const altName = (user.user_metadata?.name as string | undefined) || (user.user_metadata?.full_name as string | undefined) || composite || "User";
      setProfileUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(altName)}&background=random&bold=true`);

      // Simplified greeting name
      setUserName(first || altName.split(' ')[0]);
    };
    void load();
  }, []);
  const title = useMemo(() => {
    if (pathname.startsWith("/dashboard")) {
      if (!userName) return "Dashboard";
      const hour = new Date().getHours();
      let greeting = "Good morning";
      if (hour >= 12 && hour < 18) greeting = "Good afternoon";
      if (hour >= 18 || hour < 5) greeting = "Good evening";
      return `${greeting}, ${userName}`;
    }
    if (pathname.startsWith("/transactions")) return "Transactions";
    if (pathname.startsWith("/accounts")) return "Accounts";
    if (pathname.startsWith("/budgets")) return "Budgets";
    if (pathname.startsWith("/investments")) return "Investments";
    if (pathname.startsWith("/reports")) return "Reports";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Zentari";
  }, [pathname, userName]);

  return (
    <header id="app-topbar" className="fixed top-0 right-0 left-0 lg:left-60 xl:left-64 z-40 min-h-16 bg-[var(--color-bg)]/90 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-bg),transparent_6%)] border-b border-[var(--color-border)] dark:border-transparent flex flex-col">
      <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 h-16 w-full flex items-center gap-3 shrink-0">
        <button id="sidebar-toggle" className="lg:hidden p-2 cursor-pointer rounded-md">
          <LuMenu className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl tracking-tight">{title}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {process.env.NEXT_PUBLIC_DEBUG_MEMORY === '1' && <DebugMemoryStats />}
          {profileUrl ? (
            <img src={profileUrl} alt="Profile" className="ml-2 h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="ml-2 h-8 w-8 rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)]" />
          )}
        </div>
      </div>
      <div id="page-toolbar-portal" className="w-full" />
    </header>
  );
}


