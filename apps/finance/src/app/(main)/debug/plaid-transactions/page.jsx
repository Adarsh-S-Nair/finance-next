"use client";

import { useEffect, useState } from "react";
import PageContainer from "../../../../components/layout/PageContainer";
import { authFetch } from "../../../../lib/api/fetch";

/**
 * Disposable diagnostic page. Hits the /api/plaid/debug/plaid-transactions
 * endpoint with the in-app authFetch (so the Bearer token gets attached
 * properly) and pretty-prints the diff between what Plaid currently has
 * for the last 60 days and what's in our DB for the same window.
 *
 * Routed at /debug/plaid-transactions. Not linked from the nav — visit
 * directly. Remove the file once the IRS-transaction investigation is
 * resolved.
 */
export default function PlaidDebugPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(60);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(
          `/api/plaid/debug/plaid-transactions?days=${days}`,
        );
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(
            (body && body.error) || `Request failed (${res.status})`,
          );
        } else {
          setData(body);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <PageContainer title="Plaid debug">
      <div className="max-w-4xl space-y-4 mt-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--color-muted)]">
            Window:
          </label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-sm bg-[var(--color-surface-alt)] px-3 py-1.5 rounded-md border-0"
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>365 days</option>
            <option value={730}>730 days</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        ) : error ? (
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        ) : (
          <Report data={data} />
        )}
      </div>
    </PageContainer>
  );
}

function Report({ data }) {
  if (!data || !Array.isArray(data.items)) {
    return (
      <pre className="text-xs whitespace-pre-wrap bg-[var(--color-surface-alt)] p-4 rounded-md">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-xs text-[var(--color-muted)]">
        Window: {data.window?.startStr} → {data.window?.endStr} (
        {data.window?.days} days)
      </p>
      {data.items.map((item, i) => (
        <section
          key={item.plaid_item_uuid || i}
          className="border border-[var(--color-border)] rounded-lg p-4 space-y-3"
        >
          <header className="flex items-baseline justify-between flex-wrap gap-2">
            <h3 className="text-sm font-medium text-[var(--color-fg)] font-mono">
              {item.plaid_item_id}
            </h3>
            <span className="text-xs text-[var(--color-muted)]">
              Plaid: {item.plaid_total} · DB: {item.db_total} · Δ +
              {item.only_in_plaid_count} / −{item.only_in_db_count}
            </span>
          </header>
          {item.plaid_error && (
            <div className="text-xs text-[var(--color-danger)]">
              Plaid error: {item.plaid_error}
            </div>
          )}
          <Diff
            title={`Only in Plaid (${item.only_in_plaid_count})`}
            rows={item.only_in_plaid}
            keyField="transaction_id"
          />
          <Diff
            title={`Only in DB (${item.only_in_db_count})`}
            rows={item.only_in_db}
            keyField="plaid_transaction_id"
          />
        </section>
      ))}
    </div>
  );
}

function Diff({ title, rows, keyField }) {
  if (!rows || rows.length === 0) {
    return (
      <details>
        <summary className="text-xs text-[var(--color-muted)] cursor-default">
          {title}
        </summary>
      </details>
    );
  }
  return (
    <details open>
      <summary className="text-xs font-medium text-[var(--color-fg)] cursor-pointer">
        {title}
      </summary>
      <div className="mt-2 divide-y divide-[var(--color-border)]/30">
        {rows.map((r) => (
          <div
            key={r[keyField]}
            className="py-2 flex items-center justify-between gap-3 text-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[var(--color-fg)] truncate">
                {r.description || r.merchant_name || "(no description)"}
              </div>
              <div className="text-[10px] text-[var(--color-muted)] truncate font-mono">
                {r.date} · {r[keyField]}
                {r.account_name ? ` · ${r.account_name}` : ""}
              </div>
            </div>
            <div className="tabular-nums text-[var(--color-fg)]">
              {typeof r.amount === "number" ? formatAmount(r.amount) : "—"}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function formatAmount(n) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${abs}`;
}
