"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LuSettings } from "react-icons/lu";
import { ProfileBar, PROFILE_BAR_ITEM_CLASS } from "@zervo/ui";
import { createClient } from "@/lib/supabase/client";

type Props = {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  initials: string;
};

/**
 * Pinned-to-bottom profile card for the admin app. Wraps the shared
 * @zervo/ui ProfileBar with admin-specific items (just Settings — no
 * Upgrade/Help) and a window.location-based sign-out.
 */
export default function AdminProfileBar({ name, email, avatarUrl, initials }: Props) {
  const pathname = usePathname();

  return (
    <ProfileBar
      name={name}
      subtitle={email}
      avatarUrl={avatarUrl}
      initials={initials}
      containerClassName="fixed bottom-0 left-0 w-60 z-[60] border-t border-r border-[var(--color-fg)]/[0.06] bg-[var(--color-content-bg)]"
      signOut={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
      }}
      onSignedOut={() => {
        window.location.href = "/auth";
      }}
    >
      <Link
        href="/settings"
        className={clsx(
          PROFILE_BAR_ITEM_CLASS,
          pathname.startsWith("/settings")
            ? "text-[var(--color-fg)] font-medium bg-[var(--color-fg)]/[0.08]"
            : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
        )}
      >
        <LuSettings className="h-[18px] w-[18px] flex-shrink-0" />
        <span>Settings</span>
      </Link>
    </ProfileBar>
  );
}
