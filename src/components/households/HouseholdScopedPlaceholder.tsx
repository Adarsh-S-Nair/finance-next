"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LuConstruction } from "react-icons/lu";
import PageContainer from "../layout/PageContainer";
import { authFetch } from "../../lib/api/fetch";

type Household = {
  id: string;
  name: string;
  color: string;
  role: "owner" | "member";
  member_count: number;
};

/**
 * Shared shell for household-scoped dashboard sub-pages (accounts,
 * transactions, budgets, investments). Renders a minimal "scope is set"
 * placeholder until real household-scoped aggregation ships.
 */
export default function HouseholdScopedPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const params = useParams();
  const householdId = typeof params?.id === "string" ? params.id : null;
  const [household, setHousehold] = useState<Household | null>(null);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await authFetch(`/api/households/${householdId}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setHousehold(data.household);
      } catch (err) {
        console.error("[households] scope placeholder fetch error", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  return (
    <PageContainer
      title={
        <div className="flex items-center gap-3 min-w-0">
          {household && (
            <span
              className="block h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: household.color }}
              aria-hidden
            />
          )}
          <span className="truncate">{title}</span>
          {household && (
            <span className="text-xs font-normal text-[var(--color-muted)] hidden sm:inline truncate">
              · {household.name}
            </span>
          )}
        </div>
      }
    >
      <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-6">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
          <LuConstruction className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-[var(--color-fg)]">
            Household {title.toLowerCase()} coming soon
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)] max-w-lg">
            {description} Once members opt accounts into this household, this page
            will show the combined view.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
