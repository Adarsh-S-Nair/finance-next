import Link from "next/link";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/AdminShell";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const [{ count: userCount }, { count: proCount }] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_tier", "pro"),
  ]);

  return (
    <AdminShell email={user?.email} activePath="/">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--color-fg)]">
          Overview
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Signed in as {user?.email}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard label="Users" value={userCount ?? 0} />
        <StatCard label="Pro subscribers" value={proCount ?? 0} />
        <StatCard label="Households" value="—" muted />
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-semibold text-[var(--color-fg)] mb-2">
          Quick actions
        </h2>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Directly inspect a user's accounts, subscription, and transaction
          counts.
        </p>
        <Link
          href="/users"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          Browse users →
        </Link>
      </section>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number | string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
