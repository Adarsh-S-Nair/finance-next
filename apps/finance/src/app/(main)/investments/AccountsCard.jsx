"use client";

/**
 * AccountsCard
 *
 * Minimal list of the user's investment accounts. Each row carries the
 * institution logo on the left, account name + subtext in the middle, and
 * balance on the right. Accounts from the same institution are grouped
 * together via tighter vertical spacing; institutions are separated by
 * a larger gap. No dividers, no chevrons. Entire row is clickable.
 */

import { useMemo } from "react";
import { PiBankFill } from "react-icons/pi";
import { formatCurrency as formatCurrencyBase } from "../../../lib/formatCurrency";
import { holdingMarketValue } from "../../../lib/holdingsValue";

const formatCurrency = (amount) => formatCurrencyBase(Number(amount || 0), true);

function InstitutionAvatar({ logo, name, size = 32 }) {
  const dim = `${size}px`;
  return (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]/50 bg-[var(--color-surface)]/50"
      style={{ width: dim, height: dim }}
    >
      {logo && (

        <img
          src={logo}
          alt={name || ""}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="flex h-full w-full items-center justify-center">
        <PiBankFill className="h-3.5 w-3.5 text-[var(--color-muted)]" />
      </div>
    </div>
  );
}

export default function AccountsCard({ accounts, holdings = [], quotes = {} }) {
  // Latest market value per account, summed from its holdings. Falls back
  // to the stored balance when an account has no holdings (keeps things
  // consistent with the big number / allocation card, which value the same way).
  const liveValueByAccount = useMemo(() => {
    const map = new Map();
    for (const h of holdings || []) {
      map.set(h.account_id, (map.get(h.account_id) || 0) + holdingMarketValue(h, quotes));
    }
    return map;
  }, [holdings, quotes]);

  const accountValue = (account) =>
    liveValueByAccount.has(account.id)
      ? liveValueByAccount.get(account.id)
      : Number(account.balances?.current) || 0;

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
      entry.total += accountValue(account);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, liveValueByAccount]);

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <div className="card-header">My Accounts</div>
      </div>

      {byInstitution.length === 0 ? (
        <div className="py-2 text-sm text-[var(--color-muted)]">
          No investment accounts yet.
        </div>
      ) : (
        <div className="space-y-8">
          {byInstitution.map((inst) => (
            <div key={inst.id} className="space-y-3">
              {inst.accounts.map((account) => (
                <div
                  key={account.id}
                  className="-mx-2 flex items-center gap-3 px-2 py-3"
                >
                  <InstitutionAvatar logo={inst.logo} name={inst.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--color-fg)]">
                      {account.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                      <span className="truncate">{inst.name}</span>
                      {account.mask && (
                        <>
                          <span className="text-[var(--color-border)]">•</span>
                          <span className="font-mono">{account.mask}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-[var(--color-fg)]">
                    {formatCurrency(accountValue(account))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
