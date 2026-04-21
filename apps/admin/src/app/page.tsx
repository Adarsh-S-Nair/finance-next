import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const admin = createAdminClient();

  const [{ count: userCount }, { count: proCount }, { count: householdCount }] =
    await Promise.all([
      admin.from("user_profiles").select("*", { count: "exact", head: true }),
      admin
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("subscription_tier", "pro"),
      admin.from("households").select("*", { count: "exact", head: true }),
    ]);

  return (
    <AdminShell>
      <header className="mb-10">
        <h1 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
          Overview
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Internal state at a glance.
        </p>
      </header>

      <section className="flex flex-wrap gap-x-12 gap-y-6 mb-12">
        <Stat label="Users" value={userCount ?? 0} />
        <Stat label="Pro subscribers" value={proCount ?? 0} />
        <Stat label="Households" value={householdCount ?? 0} />
      </section>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-3">
          Quick actions
        </h2>
        <ul className="divide-y divide-[var(--color-fg)]/[0.06] border-t border-b border-[var(--color-fg)]/[0.06]">
          <li>
            <Link
              href="/users"
              className="flex items-center justify-between py-3 text-sm text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors"
            >
              <span>Browse users</span>
              <span className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)]">
                ›
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]/70">
        {label}
      </div>
      <div className="mt-1 text-3xl font-medium tabular-nums text-[var(--color-fg)]">
        {value}
      </div>
    </div>
  );
}
