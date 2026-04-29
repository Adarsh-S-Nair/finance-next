"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { FaLock } from "react-icons/fa";
import { LuSettings, LuHeadphones, LuSparkles } from "react-icons/lu";
import { ProfileBar as BaseProfileBar, PROFILE_BAR_ITEM_CLASS } from "@zervo/ui";
import { useUser } from "../providers/UserProvider";
import { supabase } from "../../lib/supabase/client";
import UpgradeOverlay from "../UpgradeOverlay";

/**
 * Floating profile card pinned to the bottom-left, spanning the household
 * rail and the main sidebar. Wraps the shared @zervo/ui ProfileBar with
 * finance-specific items (Upgrade / Settings / Help) and wires sign-out
 * into the UserProvider + router.
 */
export default function ProfileBar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, logout } = useUser();
  const [showUpgradeOverlay, setShowUpgradeOverlay] = useState(false);

  const meta =
    (user as unknown as { user_metadata?: Record<string, unknown> })
      ?.user_metadata ?? {};
  const firstName =
    profile?.first_name || (meta.first_name as string | undefined) || "";
  const lastName =
    profile?.last_name || (meta.last_name as string | undefined) || "";
  const rawName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    (meta.name as string | undefined) ||
    (meta.full_name as string | undefined) ||
    "";
  const fullName = rawName
    ? rawName
        .trim()
        .split(/\s+/)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : user?.email || "";
  const initials =
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : firstName
        ? firstName[0].toUpperCase()
        : (user?.email?.[0]?.toUpperCase() ?? "?");
  const tier = profile?.subscription_tier ?? "free";
  const avatarUrl =
    profile?.avatar_url ||
    (meta.avatar_url as string | undefined) ||
    (meta.picture as string | undefined) ||
    null;

  return (
    <>
      <BaseProfileBar
        name={fullName || "User"}
        subtitle={tier === "pro" ? "Pro" : "Free"}
        avatarUrl={avatarUrl}
        initials={initials}
        containerClassName="hidden md:flex flex-col fixed bottom-0 left-0 md:w-20 xl:w-60 z-[60] border-t border-[var(--color-fg)]/[0.06] bg-[var(--color-shell-bg)]"
        infoClassName="flex-1 min-w-0 hidden xl:block"
        chevronClassName="h-3.5 w-3.5 text-[var(--color-muted)]/60 flex-shrink-0 hidden xl:block group-hover:text-[var(--color-muted)]"
        signOutLabel={<span className="hidden xl:inline">Log out</span>}
        signOut={async () => {
          await supabase.auth.signOut();
        }}
        onSignedOut={() => {
          logout();
          onNavigate?.();
          router.replace("/");
        }}
      >
        {({ close }) => (
          <>
            {tier === "free" && (
              <button
                onClick={() => {
                  close();
                  setShowUpgradeOverlay(true);
                }}
                className={clsx(
                  PROFILE_BAR_ITEM_CLASS,
                  "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10",
                )}
              >
                <LuSparkles className="h-[18px] w-[18px] flex-shrink-0" />
                <span className="hidden xl:inline">Upgrade to Pro</span>
              </button>
            )}

            <Link
              href="/settings"
              onClick={() => onNavigate?.()}
              className={clsx(
                PROFILE_BAR_ITEM_CLASS,
                pathname.startsWith("/settings")
                  ? "text-[var(--color-fg)] font-medium bg-[var(--color-fg)]/[0.08]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
              )}
            >
              <LuSettings className="h-[18px] w-[18px] flex-shrink-0" />
              <span className="hidden xl:inline">Settings</span>
            </Link>

            <div
              className={clsx(
                PROFILE_BAR_ITEM_CLASS,
                "text-[var(--color-muted)] opacity-40 cursor-not-allowed",
              )}
            >
              <LuHeadphones className="h-[18px] w-[18px] flex-shrink-0" />
              <span className="hidden xl:inline flex-1">Help &amp; Support</span>
              <FaLock className="h-3 w-3 opacity-60 hidden xl:block" />
            </div>
          </>
        )}
      </BaseProfileBar>

      <UpgradeOverlay
        isOpen={showUpgradeOverlay}
        onClose={() => setShowUpgradeOverlay(false)}
      />
    </>
  );
}
