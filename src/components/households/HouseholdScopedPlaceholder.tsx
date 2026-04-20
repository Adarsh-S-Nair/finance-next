"use client";

import { LuConstruction } from "react-icons/lu";
import PageContainer from "../layout/PageContainer";

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
  return (
    <PageContainer title={title}>
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
