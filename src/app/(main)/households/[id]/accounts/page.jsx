"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PiBankFill } from "react-icons/pi";
import PageContainer from "../../../../../components/layout/PageContainer";
import { authFetch } from "../../../../../lib/api/fetch";
import { isLiabilityAccount } from "../../../../../lib/accountUtils";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);

function memberName(owner) {
  if (!owner) return "Member";
  const first = owner.first_name || "";
  const last = owner.last_name || "";
  const name = [first, last].filter(Boolean).join(" ");
  return name || "Member";
}

function memberInitials(owner) {
  if (!owner) return "?";
  const first = owner.first_name || "";
  const last = owner.last_name || "";
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  if (last) return last[0].toUpperCase();
  return "?";
}

function AccountRow({ account }) {
  const institution = account.institutions || {};
  const owner = account.owner;

  return (
    <div className="group flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-card-highlight)] transition-all duration-200 rounded-lg">
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-[var(--color-surface)]/50 border border-[var(--color-border)]/50">
          {institution.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={institution.logo}
              alt={institution.name || ""}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = "none";
                if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div className={`w-full h-full flex items-center justify-center ${institution.logo ? "hidden" : "flex"}`}>
            <PiBankFill className="w-4 h-4 text-[var(--color-muted)]" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-[var(--color-fg)] text-sm mb-0.5 truncate">
            {account.name}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <span className="truncate max-w-[160px]">{institution.name || "Unknown"}</span>
            {account.mask && (
              <>
                <span className="text-[var(--color-border)]">•</span>
                <span className="font-mono">•••• {account.mask}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Owner chip — who in the household owns this account */}
      <div className="hidden sm:flex items-center gap-2 mr-4 min-w-0">
        <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent)] text-[10px] font-semibold text-[var(--color-on-accent,white)]">
          {owner?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={owner.avatar_url} alt={memberName(owner)} className="h-full w-full object-cover" />
          ) : (
            <span>{memberInitials(owner)}</span>
          )}
        </div>
        <span className="text-xs text-[var(--color-muted)] truncate max-w-[120px]">
          {memberName(owner)}
        </span>
      </div>

      <div className="text-right">
        <div className="font-semibold text-[var(--color-fg)] tabular-nums text-sm">
          {formatCurrency(account.balances?.current || 0)}
        </div>
      </div>
    </div>
  );
}

function CategoryHeader({ title, total }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <h3 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider opacity-80">
        {title}
      </h3>
      <div className="text-xs font-semibold text-[var(--color-muted)] tabular-nums">
        {formatCurrency(total)}
      </div>
    </div>
  );
}

function categorizeAccount(account) {
  const type = `${account.type || ""} ${account.subtype || ""}`.toLowerCase();
  const investment = ["brokerage", "stock plan", "ira", "401k", "403b", "529", "roth", "sep", "simple", "keogh", "pension", "retirement", "investment"];
  if (investment.some((k) => type.includes(k))) return "investments";
  if (type.includes("credit")) return "credit";
  const loans = ["loan", "mortgage", "student", "auto", "home equity"];
  if (loans.some((k) => type.includes(k))) return "loans";
  return "cash";
}

export default function HouseholdAccountsPage() {
  const params = useParams();
  const householdId = typeof params?.id === "string" ? params.id : null;

  const [household, setHousehold] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!householdId) return;
    try {
      setLoading(true);
      setError(null);
      const [householdRes, accountsRes] = await Promise.all([
        authFetch(`/api/households/${householdId}`),
        authFetch(`/api/households/${householdId}/accounts`),
      ]);
      if (householdRes.ok) {
        const data = await householdRes.json();
        setHousehold(data.household);
      }
      if (!accountsRes.ok) {
        setError(`Failed to load accounts (${accountsRes.status}).`);
        return;
      }
      const data = await accountsRes.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error("[households] accounts load error", err);
      setError(err?.message || "Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = accounts.reduce(
    (acc, a) => {
      const balance = a.balances?.current || 0;
      const normalized = { balance, type: a.type, subtype: a.subtype };
      const isLiability = isLiabilityAccount(normalized);
      if (isLiability || balance < 0) acc.liabilities += Math.abs(balance);
      else if (balance > 0) acc.assets += balance;
      return acc;
    },
    { assets: 0, liabilities: 0 },
  );
  const netWorth = totals.assets - totals.liabilities;

  const categorized = { cash: [], investments: [], credit: [], loans: [] };
  for (const a of accounts) categorized[categorizeAccount(a)].push(a);

  const titleNode = (
    <div className="flex items-center gap-3 min-w-0">
      {household && (
        <span
          className="block h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: household.color }}
          aria-hidden
        />
      )}
      <span className="truncate">Accounts</span>
      {household && (
        <span className="text-xs font-normal text-[var(--color-muted)] hidden sm:inline truncate">
          · {household.name}
        </span>
      )}
    </div>
  );

  if (loading) {
    return (
      <PageContainer title={titleNode}>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-fg)]" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title={titleNode}>
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      </PageContainer>
    );
  }

  if (accounts.length === 0) {
    return (
      <PageContainer title={titleNode}>
        <div className="text-center py-24">
          <div className="mx-auto w-20 h-20 bg-[var(--color-surface)] rounded-full flex items-center justify-center mb-6 shadow-sm border border-[var(--color-border)]">
            <PiBankFill className="h-10 w-10 text-[var(--color-muted)]" />
          </div>
          <h3 className="text-xl font-medium text-[var(--color-fg)] mb-2">No accounts in this household yet</h3>
          <p className="text-[var(--color-muted)] max-w-md mx-auto">
            Once members connect accounts, they&apos;ll show up here combined across everyone.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title={titleNode}>
      <div className="space-y-10">
        {/* Summary */}
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-2/3">
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
              Household net worth
            </div>
            <div className="mt-2 text-[44px] md:text-[56px] font-medium tracking-tight text-[var(--color-fg)] tabular-nums leading-none">
              {formatCurrency(netWorth)}
            </div>
            <p className="mt-3 text-xs text-[var(--color-muted)] max-w-md">
              Combined across every member of {household?.name ?? "this household"}.
            </p>
          </div>
          <div className="lg:w-1/3 grid grid-cols-2 gap-6">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
                Assets
              </div>
              <div className="mt-2 text-xl font-semibold text-[var(--color-fg)] tabular-nums">
                {formatCurrency(totals.assets)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
                Liabilities
              </div>
              <div className="mt-2 text-xl font-semibold text-[var(--color-fg)] tabular-nums">
                {formatCurrency(totals.liabilities)}
              </div>
            </div>
          </div>
        </div>

        {/* Accounts list */}
        <div className="pt-4">
          <div className="mb-6 px-1">
            <h2 className="text-lg font-medium text-[var(--color-fg)]">All Accounts</h2>
          </div>

          <div className="overflow-hidden">
            {categorized.cash.length > 0 && (
              <>
                <CategoryHeader
                  title="Cash & Checking"
                  total={categorized.cash.reduce((s, a) => s + (a.balances?.current || 0), 0)}
                />
                {categorized.cash.map((a) => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </>
            )}
            {categorized.investments.length > 0 && (
              <>
                <CategoryHeader
                  title="Investments"
                  total={categorized.investments.reduce((s, a) => s + (a.balances?.current || 0), 0)}
                />
                {categorized.investments.map((a) => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </>
            )}
            {categorized.credit.length > 0 && (
              <>
                <CategoryHeader
                  title="Credit Cards"
                  total={categorized.credit.reduce((s, a) => s + (a.balances?.current || 0), 0)}
                />
                {categorized.credit.map((a) => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </>
            )}
            {categorized.loans.length > 0 && (
              <>
                <CategoryHeader
                  title="Loans & Mortgages"
                  total={categorized.loans.reduce((s, a) => s + (a.balances?.current || 0), 0)}
                />
                {categorized.loans.map((a) => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
