import { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import { createClient } from "@/lib/supabase/server";

/**
 * Top-level layout for signed-in admin routes. Renders the shared
 * floating sidebar on the left and the topbar + page body to the right.
 * Identity / sign-out live inside the sidebar's bottom more-menu, so
 * there's no separate profile bar.
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
      <AdminSidebar
        name={name}
        email={user?.email ?? null}
        avatarUrl={avatarUrl}
        initials={initials}
      />
      {/* Floating sidebar floats at left:12 with w:14 (56px); content
          starts past its right edge plus a 12px breathing gap
          (12 + 56 + 12 = 80px) to match finance's AppShell. */}
      <main className="min-h-screen md:pl-20">
        <AdminTopbar />
        <div className="max-w-6xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
