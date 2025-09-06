"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { supabase } from "../lib/supabaseClient";
import { NAV_GROUPS } from "./nav";
import { FaLock } from "react-icons/fa";
import { TbLogout } from "react-icons/tb";
import Button from "./ui/Button";

export default function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("You");
  const [profileUrl, setProfileUrl] = useState(null as string | null);
  const [businessName, setBusinessName] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (user) {
        const first = (user.user_metadata?.first_name as string | undefined) || "";
        const last = (user.user_metadata?.last_name as string | undefined) || "";
        const composite = `${first} ${last}`.trim();
        const rawName = (user.user_metadata?.name as string | undefined)
          || (user.user_metadata?.full_name as string | undefined)
          || composite
          || "";
        const nonEmailName = /@/.test(rawName) ? "" : rawName;
        const fromEmail = (email?: string) => {
          if (!email) return "";
          const local = email.split("@")[0] || "";
          if (!local) return "";
          return local.charAt(0).toUpperCase() + local.slice(1);
        };
        const finalName = (nonEmailName && nonEmailName.trim()) || fromEmail(user.email) || "You";
        setDisplayName(finalName);

        const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=random&bold=true`;
        setProfileUrl(avatar);
      }
      // Optional: business name is not critical yet; clear it if not available
      try {
        const { data: biz } = await supabase.from("business_profiles").select("name").limit(1).maybeSingle();
        setBusinessName(biz?.name || "");
      } catch {
        setBusinessName("");
      }
    };
    void load();
  }, []);

  const groups = useMemo(() => NAV_GROUPS, []);

  const onLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await supabase.auth.signOut();
    onNavigate?.();
    router.replace("/");
    setIsSigningOut(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="h-16 shrink-0 px-4 flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-[var(--color-primary)] text-[var(--color-on-primary)] grid place-items-center text-xs font-bold">Ƒ</div>
        <span className="text-sm font-semibold tracking-tight">Zentari</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.title} className="mt-3 first:mt-0">
            <div className="px-2 text-[11px] uppercase tracking-wider text-[var(--color-muted)]">{g.title}</div>
            <ul className="mt-2 space-y-1">
              {g.items.map((it) => {
                const active = pathname.startsWith(it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.disabled ? "#" : it.href}
                      onClick={(e) => {
                        if (it.disabled) {
                          e.preventDefault();
                          return;
                        }
                        onNavigate?.();
                      }}
                      aria-disabled={it.disabled || undefined}
                      className={clsx(
                        "group relative flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm",
                        it.disabled
                          ? "cursor-not-allowed text-[color-mix(in_oklab,var(--color-muted),var(--color-bg)_40%)] opacity-70"
                          : "hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]",
                        active && !it.disabled && "bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)] text-[var(--color-fg)]"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className={it.disabled ? "opacity-40" : undefined}>{it.icon && <it.icon className="h-4 w-4" />}</span>
                        <span className={it.disabled ? "text-[color-mix(in_oklab,var(--color-muted),var(--color-bg)_40%)]" : undefined}>{it.label}</span>
                      </span>
                      {it.disabled && <FaLock className="h-3.5 w-3.5 text-[color-mix(in_oklab,var(--color-muted),var(--color-bg)_40%)]" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="my-3 h-px w-full bg-[color-mix(in_oklab,var(--color-fg),transparent_92%)]" />
          </div>
        ))}
      </nav>
      <div className="p-3 pt-0">
        <div className="rounded-lg bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {profileUrl ? (
                <img src={profileUrl} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)]" />
              )}
              <div>
                <div className="text-sm font-medium">{displayName}</div>
                <div className="text-xs text-[var(--color-muted)]">{businessName || ""}</div>
              </div>
            </div>
            <Button
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
              variant="ghost"
              size="sm"
              className="inline-flex items-center gap-2 rounded-[6px] text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]"
            >
              <TbLogout className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


