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

const isCreditAccount = (type) => {
  const t = (type || "").toLowerCase();
  return t.includes("credit");
};

export default function AccountDetails({ account, institution }) {
  if (!account) return null;

  const subtypeLabel = formatAccountSubtype(account.type);
  const isLiability = isLiabilityAccount(account);
  const isCredit = isCreditAccount(account.type);
  const currency = account.isoCurrencyCode || "USD";

  const utilization =
    isCredit && account.limit && account.limit > 0
      ? Math.min(Math.max((account.balance || 0) / account.limit, 0), 1)
      : null;

  const addedOn = formatDate(account.createdAt);

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
              {subtypeLabel && account.mask && (
                <span className="opacity-40">·</span>
              )}
              {account.mask && <span className="font-mono">•••• {account.mask}</span>}
            </div>
          </div>

          <div
            className={clsx(
              "text-lg font-medium tracking-tight tabular-nums whitespace-nowrap",
              isLiability ? "text-[var(--color-fg)]" : "text-[var(--color-fg)]"
            )}
          >
            {formatCurrency(account.balance, currency)}
          </div>
        </div>

        {/* Detail Rows */}
        <div className="px-5 space-y-6 pb-6">
          <div>
            {/* Current Balance */}
            <div className="flex items-center justify-between py-2">
              <span className="card-header">
                {isLiability ? "Current Owed" : "Current Balance"}
              </span>
              <span className="text-sm text-[var(--color-fg)] tabular-nums">
                {formatCurrency(account.balance, currency)}
              </span>
            </div>

            {/* Available Balance */}
            {account.available != null && (
              <div className="flex items-center justify-between py-2">
                <span className="card-header">Available</span>
                <span className="text-sm text-[var(--color-fg)] tabular-nums">
                  {formatCurrency(account.available, currency)}
                </span>
              </div>
            )}

            {/* Credit Limit (credit accounts only) */}
            {isCredit && account.limit != null && (
              <div className="flex items-center justify-between py-2">
                <span className="card-header">Credit Limit</span>
                <span className="text-sm text-[var(--color-fg)] tabular-nums">
                  {formatCurrency(account.limit, currency)}
                </span>
              </div>
            )}

            {/* Utilization (credit accounts with a limit) */}
            {utilization != null && (
              <div className="py-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="card-header">Utilization</span>
                  <span className="text-sm text-[var(--color-fg)] tabular-nums">
                    {(utilization * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all",
                      utilization < 0.3
                        ? "bg-emerald-500"
                        : utilization < 0.7
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    )}
                    style={{ width: `${utilization * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Institution */}
            {institution?.name && (
              <div className="flex items-center justify-between py-2">
                <span className="card-header">Institution</span>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end pl-4">
                  {institution.logo && (
                    <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-white">
                      <img
                        src={institution.logo}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <span className="text-sm text-[var(--color-fg)] truncate text-right">
                    {institution.name}
                  </span>
                </div>
              </div>
            )}

            {/* Type */}
            {subtypeLabel && (
              <div className="flex items-center justify-between py-2">
                <span className="card-header">Type</span>
                <span className="text-sm text-[var(--color-fg)]">{subtypeLabel}</span>
              </div>
            )}

            {/* Account Number */}
            {account.mask && (
              <div className="flex items-center justify-between py-2">
                <span className="card-header">Account Number</span>
                <span className="text-sm text-[var(--color-fg)] font-mono">
                  •••• {account.mask}
                </span>
              </div>
            )}

            {/* Added On */}
            {addedOn && (
              <div className="flex items-center justify-between py-2">
                <span className="card-header">Added</span>
                <span className="text-sm text-[var(--color-fg)]">{addedOn}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
