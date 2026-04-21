import { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminProfileBar from "./AdminProfileBar";
import { createClient } from "@/lib/supabase/server";

/**
 * Top-level layout for signed-in admin routes. Mirrors the structure of
 * finance's AppShell (sidebar pinned left, profile bar at bottom-left,
 * content to the right) but uses admin-specific nav and profile data.
 */
export default async function AdminShell({ children }: { children: ReactNode }) {
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
      <AdminSidebar />
      <AdminProfileBar
        name={name}
        email={user?.email ?? null}
        avatarUrl={avatarUrl}
        initials={initials}
      />
      <main className="ml-60 min-h-screen">
        <div className="max-w-6xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
