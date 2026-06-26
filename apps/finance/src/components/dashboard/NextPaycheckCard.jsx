"use client";

import React, { useMemo } from 'react';
import { useAuthedQuery } from '../../lib/api/useAuthedQuery';
import { useUser } from '../providers/UserProvider';
import { FiTrendingUp } from 'react-icons/fi';
import { formatCurrency as formatCurrencyBase } from '../../lib/formatCurrency';

/**
 * "Next paycheck" — reads the user's detected income profile
 * (/api/income/profile), which the nightly sweep computes by clustering
 * real payroll deposits and discarding transfers, equity sales, and
 * refunds. Shows the primary paycheck: expected amount and the predicted
 * next deposit date. This is NOT Plaid's recurring-stream guess (which
 * misses payroll and counts transfers as income).
 */

const formatCurrency = (amount) => formatCurrencyBase(amount, true);

const CADENCE_LABEL = {
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 weeks',
  SEMIMONTHLY: 'Twice a month',
  MONTHLY: 'Monthly',
  IRREGULAR: 'Irregular',
};

// Strip the boilerplate Plaid prepends so "Direct deposit from 100-SFDC
// INC." reads as "100-SFDC INC." Best-effort; the assistant can later set a
// cleaner employer name.
function cleanEmployer(label) {
  if (!label) return 'Your employer';
  return label.replace(/^(direct deposit from|deposit from|from)\s+/i, '').trim() || label;
}

function parseDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatRelativeDay(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseDay(iso);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 14) return `in ${diff} days`;
  return `in ${Math.round(diff / 7)} weeks`;
}

function formatAbsoluteDay(iso) {
  return parseDay(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function NextPaycheckCard({ className = '', mockData }) {
  const { user, isPro: liveIsPro, loading: authLoading } = useUser();
  const isPro = mockData ? true : liveIsPro;

  const queryEnabled = !mockData && !authLoading && !!user?.id && liveIsPro;
  const { data, isLoading } = useAuthedQuery(
    ['income-profile', user?.id],
    queryEnabled ? '/api/income/profile' : null,
  );
  const profile = mockData?.profile ?? data ?? null;
  const loading = mockData ? false : queryEnabled ? isLoading : false;

  const primary = profile?.primary ?? null;
  const cadenceLabel = useMemo(
    () => (primary?.cadence ? CADENCE_LABEL[primary.cadence] : null),
    [primary?.cadence],
  );

  if (loading) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-[var(--color-border)] rounded w-32" />
          </div>
          <div className="h-7 bg-[var(--color-border)] rounded w-28 mb-1" />
          <div className="h-2.5 bg-[var(--color-border)] rounded w-36" />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="card-header">Next paycheck</h3>
      </div>

      {!isPro ? (
        <div className="text-center py-6 text-xs text-[var(--color-muted)]">
          Upgrade to Pro to see income predictions
        </div>
      ) : primary && primary.expectedAmount != null ? (
        <div>
          {/* Headline: expected amount + when the next one lands. */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-[var(--color-fg)]">
              {formatCurrency(primary.expectedAmount)}
            </span>
            {primary.nextDate && (
              <span className="text-xs font-medium text-[var(--color-success)]">
                {formatRelativeDay(primary.nextDate)}
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--color-muted)] mt-1">
            {cleanEmployer(primary.employer)}
            {primary.nextDate ? ` · ${formatAbsoluteDay(primary.nextDate)}` : ''}
          </div>
          {cadenceLabel && (
            <div className="text-[11px] text-[var(--color-muted)] mt-2">
              {cadenceLabel} · typical of your recent paychecks
            </div>
          )}
        </div>
      ) : (
        <div className="py-2 flex items-start gap-2.5">
          <FiTrendingUp className="h-4 w-4 mt-0.5 text-[var(--color-muted)] flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-[var(--color-fg)]">
              No paycheck detected yet
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-1">
              We&apos;ll predict your next paycheck once a few deposits land
              from the same employer.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
