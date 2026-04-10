"use client";

/**
 * AccountsCard
 *
 * Compact list of the user's investment accounts, grouped by institution.
 * Designed to sit in the 1/3 side column under AllocationCard, mirroring the
 * AssetsCard / LiabilitiesCard placement pattern on the accounts page.
 *
 * Props:
 *   accounts: Array<{ id, name, subtype, mask, balances, institutions: { id, name, logo } }>
 */

import Link from "next/link";
import { useMemo } from "react";
import { LuChevronRight } from "react-icons/lu";
import { PiBankFill } from "react-icons/pi";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

export default function AccountsCard({ accounts }) {
  const byInstitution = useMemo(() => {
    const map = new Map();
    for (const account of accounts || []) {
      const inst = account.institutions || {};
      const key = inst.id || account.institution_id || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: inst.name || "Unknown",
          logo: inst.logo || null,
          accounts: [],
          total: 0,
        });
      }
      const entry = map.get(key);
      entry.accounts.push(account);
      entry.total += Number(account.balances?.current) || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [accounts]);

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <div className="card-header">My Accounts</div>
      </div>

      {byInstitution.length === 0 ? (
        <div className="py-2 text-sm text-[var(--color-muted)]">No investment accounts yet.</div>
      ) : (
        <div className="space-y-6">
          {byInstitution.map((inst) => (
            <div key={inst.id}>
              {/* Institution header */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)]/50 bg-[var(--color-surface)]/50">
                    {inst.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={inst.logo}
                        alt={inst.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className={`h-full w-full items-center justify-center ${inst.logo ? "hidden" : "flex"}`}
                    >
                      <PiBankFill className="h-2.5 w-2.5 text-[var(--color-muted)]" />
                    </div>
                  </div>
                  <span className="truncate text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)] opacity-80">
                    {inst.name}
                  </span>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-[var(--color-muted)]">
                  {formatCurrency(inst.total)}
                </span>
              </div>

              {/* Accounts in this institution */}
              <div className="divide-y divide-[var(--color-border)]/60">
                {inst.accounts.map((account) => (
                  <Link
                    key={account.id}
                    href={`/investments/${account.id}`}
                    className="group flex items-center justify-between py-2.5 transition-colors hover:opacity-80"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="truncate text-sm font-medium text-[var(--color-fg)]">
                        {account.name}
                      </div>
                      {account.mask && (
                        <div className="mt-0.5 font-mono text-[11px] text-[var(--color-muted)]">
                          •••• {account.mask}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold tabular-nums text-[var(--color-fg)]">
                        {formatCurrency(account.balances?.current)}
                      </span>
                      <LuChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-fg)]" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
