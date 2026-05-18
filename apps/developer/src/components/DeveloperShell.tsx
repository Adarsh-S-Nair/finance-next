import { ReactNode } from "react";
import DeveloperSidebar from "./DeveloperSidebar";
import DeveloperTopbar from "./DeveloperTopbar";
import { createClient } from "@/lib/supabase/server";

/**
 * Signed-in layout for the developer portal. Shared floating sidebar on
 * the left, sticky topbar + page body to the right. Same chrome as
 * apps/admin's AdminShell.
 */
export default async function DeveloperShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const firstName = (meta.first_name as string | undefined) ?? "";
  const lastName = (meta.last_name as string | undefined) ?? "";
  const metaName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    (meta.name as string | undefined) ||
    (meta.full_name as string | undefined) ||
    null;
  const name = metaName || user?.email?.split("@")[0] || null;
  const avatarUrl =
    (meta.avatar_url as string | undefined) ||
    (meta.picture as string | undefined) ||
    null;

  const initials =
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : firstName
        ? firstName[0]!.toUpperCase()
        : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-[var(--color-content-bg)]">
      <DeveloperSidebar
        name={name}
        email={user?.email ?? null}
        avatarUrl={avatarUrl}
        initials={initials}
      />
      <main className="min-h-screen md:pl-20">
        <DeveloperTopbar />
        <div className="max-w-6xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
