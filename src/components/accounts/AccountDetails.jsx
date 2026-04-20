import { PiBankFill } from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { formatAccountSubtype } from "../../lib/accountSubtype";
import { isLiabilityAccount } from "../../lib/accountUtils";

const formatCurrency = (amount, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount ?? 0);
};

const formatDate = (value) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return null;
  }
};

const formatUtilizationPct = (frac) => {
  const pct = frac * 100;
  if (pct === 0) return "0%";
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
};

const isCreditAccount = (type) => {
  const t = (type || "").toLowerCase();
  return t.includes("credit");
};

function CreditUtilization({ balance, limit, available, currency }) {
  const used = Math.max(balance || 0, 0);
  const utilization = limit > 0 ? Math.min(used / limit, 1) : 0;
  const availableCredit = available != null ? available : Math.max(limit - used, 0);

  const barColor =
    utilization < 0.3
      ? "bg-emerald-500"
      : utilization < 0.7
      ? "bg-amber-500"
      : "bg-rose-500";

  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xl font-medium text-[var(--color-fg)] tabular-nums tracking-tight">
            {formatCurrency(used, currency)}
          </span>
          <span className="text-xs text-[var(--color-muted)] truncate">
            of {formatCurrency(limit, currency)} limit
          </span>
        </div>
        <span className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
          {formatUtilizationPct(utilization)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
        <motion.div
          className={clsx("h-full rounded-full", barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${utilization * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <div className="mt-2.5 text-xs text-[var(--color-muted)] tabular-nums">
        {formatCurrency(availableCredit, currency)} available
      </div>
    </div>
  );
}

export default function AccountDetails({ account, institution, onViewTransactions }) {
  if (!account) return null;

  const subtypeLabel = formatAccountSubtype(account.type);
  const isLiability = isLiabilityAccount(account);
  const isCredit = isCreditAccount(account.type);
  const currency = account.isoCurrencyCode || "USD";
  const addedOn = formatDate(account.createdAt);

  const hasCreditVisual = isCredit && account.limit != null && account.limit > 0;
  const showAvailableRow =
    !hasCreditVisual &&
    account.available != null &&
    Math.abs((account.available ?? 0) - (account.balance ?? 0)) > 0.005;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={account.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.25, ease: "circOut" }}
        className="flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-6">
          <div className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-[var(--color-surface)]/50 border border-[var(--color-border)]/50">
            {institution?.logo ? (
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
            <div
              className={`w-full h-full flex items-center justify-center ${institution?.logo ? "hidden" : "flex"}`}
            >
              <PiBankFill className="w-5 h-5 text-[var(--color-muted)]" />
            </div>
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <h2 className="text-base font-medium text-[var(--color-fg)] truncate">
              {account.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] mt-0.5">
              {subtypeLabel && <span className="truncate">{subtypeLabel}</span>}
              {subtypeLabel && account.mask && <span className="opacity-40">·</span>}
              {account.mask && <span className="font-mono">•••• {account.mask}</span>}
            </div>
          </div>

          <div className="text-lg font-medium tracking-tight tabular-nums whitespace-nowrap text-[var(--color-fg)]">
            {formatCurrency(account.balance, currency)}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 space-y-6 pb-6">
          {/* Credit utilization visual */}
          {hasCreditVisual && (
            <div>
              <div className="card-header mb-3">Credit Used</div>
              <CreditUtilization
                balance={account.balance}
                limit={account.limit}
                available={account.available}
                currency={currency}
              />
            </div>
          )}

          {/* Meta rows */}
          {(showAvailableRow || institution?.name || addedOn) && (
            <div>
              {showAvailableRow && (
                <div className="flex items-center justify-between py-2">
                  <span className="card-header">Available</span>
                  <span className="text-sm text-[var(--color-fg)] tabular-nums">
                    {formatCurrency(account.available, currency)}
                  </span>
                </div>
              )}

              {institution?.name && (
                <div className="flex items-center justify-between py-2">
                  <span className="card-header">Institution</span>
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end pl-4">
                    {institution.logo && (
                      <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-surface)]/50 border border-[var(--color-border)]/50">
                        <img
                          src={institution.logo}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <span className="text-sm text-[var(--color-fg)] truncate text-right">
                      {institution.name}
                    </span>
                  </div>
                </div>
              )}

              {addedOn && (
                <div className="flex items-center justify-between py-2">
                  <span className="card-header">Added</span>
                  <span className="text-sm text-[var(--color-fg)]">{addedOn}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {onViewTransactions && (
            <div>
              <button
                type="button"
                onClick={onViewTransactions}
                className="group flex items-center justify-between w-full py-2 -mx-2 px-2 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors"
              >
                <span className="text-sm text-[var(--color-fg)]">View transactions</span>
                <span className="text-[var(--color-muted)] text-xs opacity-0 group-hover:opacity-100 transition-opacity">&#8250;</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
