import { FiTag, FiUser } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import DynamicIcon from "../DynamicIcon";
import clsx from "clsx";
import Button from "../ui/Button";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

export default function TransactionDetails({ transaction, onCategoryClick, onSplitClick, onRepaymentClick, onDeleteSplit, onTransactionLinkClick }) {
  if (!transaction) return null;

  const isIncome = transaction.amount > 0;

  // Formatters
  const dateToFormat = transaction.date || transaction.datetime;
  const formattedDate = dateToFormat
    ? new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(dateToFormat))
    : 'Unknown Date';

  const formattedTime = transaction.datetime
    ? new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(transaction.datetime))
    : null;

  // Institution Logo
  const institutionLogo = transaction.accounts?.institutions?.logo;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={transaction.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.25, ease: "circOut" }}
        className="flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-6">
          {/* Logo / Icon */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{
              backgroundColor: (!DISABLE_LOGOS && transaction.icon_url)
                ? 'transparent'
                : (transaction.category_hex_color || 'var(--color-accent)')
            }}
          >
            {(!DISABLE_LOGOS && transaction.icon_url) ? (
              <img
                src={transaction.icon_url}
                alt={transaction.merchant_name || transaction.description}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const fallbackIcon = e.target.nextSibling;
                  if (fallbackIcon) fallbackIcon.style.display = 'block';
                }}
              />
            ) : null}
            <DynamicIcon
              iconLib={transaction.category_icon_lib}
              iconName={transaction.category_icon_name}
              className="h-5 w-5 text-white"
              fallback={FiTag}
              style={{
                display: (!DISABLE_LOGOS && transaction.icon_url) ? 'none' : 'block',
                strokeWidth: 2.5,
              }}
            />
          </div>

          {/* Merchant Name & Date */}
          <div className="flex flex-col min-w-0 flex-1">
            <h2 className="text-base font-medium text-[var(--color-fg)] truncate">
              {transaction.merchant_name || transaction.description || 'Transaction'}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] mt-0.5">
              <span>{formattedDate}</span>
              {formattedTime && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{formattedTime}</span>
                </>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className={clsx(
            "text-lg font-medium tracking-tight tabular-nums whitespace-nowrap",
            isIncome ? "text-emerald-500" : "text-[var(--color-fg)]"
          )}>
            {isIncome ? '+' : ''}{formatCurrency(transaction.amount)}
          </div>
        </div>

        {/* Detail Rows */}
        <div className="px-5 space-y-6">
          <div className="divide-y divide-[var(--color-border)]">

            {/* Status Row */}
            <div className="flex items-center justify-between py-3.5">
              <span className="card-header">Status</span>
              <span className="text-sm text-[var(--color-fg)]">
                {transaction.pending ? 'Pending' : 'Posted'}
              </span>
            </div>

            {/* Category Row */}
            <div
              onClick={onCategoryClick}
              className="group flex items-center justify-between py-3.5 -mx-2 px-2 rounded-lg cursor-pointer hover:bg-[var(--color-surface-alt)]/40 transition-colors"
            >
              <span className="card-header flex-shrink-0">Category</span>
              <div className="flex items-center gap-2 min-w-0 flex-1 justify-end pl-4">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: (transaction.category_hex_color || 'var(--color-accent)') }}
                />
                <span className="text-sm text-[var(--color-fg)] truncate text-right">{transaction.category_name}</span>
                <span className="text-[var(--color-muted)] text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">&#8250;</span>
              </div>
            </div>

            {/* Account Row */}
            {transaction.account_name && (
              <div className="flex items-center justify-between py-3.5">
                <span className="card-header">Account</span>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end pl-4">
                  {institutionLogo && (
                    <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-white">
                      <img
                        src={`data:image/png;base64,${institutionLogo}`}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <span className="text-sm text-[var(--color-fg)] truncate text-right">
                    {transaction.account_name}
                    {transaction.accounts?.mask && <span className="text-[var(--color-muted)] ml-1">··{transaction.accounts.mask}</span>}
                  </span>
                </div>
              </div>
            )}

            {/* Location Row */}
            {transaction.location && (
              <div className="flex items-center justify-between py-3.5">
                <span className="card-header">Location</span>
                <span className="text-sm text-[var(--color-fg)] truncate max-w-[60%] text-right">
                  {typeof transaction.location === 'string'
                    ? transaction.location
                    : transaction.location?.address || `${transaction.location?.city || ''}, ${transaction.location?.region || ''}`.replace(/^,\s*|,\s*$/g, '') || 'Unknown'}
                </span>
              </div>
            )}
          </div>

          {/* Reimbursement Requests (Splits) */}
          {transaction.transaction_splits && transaction.transaction_splits.length > 0 && (
            <div>
              <div className="card-header mb-3">Reimbursement Requests</div>
              <div className="divide-y divide-[var(--color-border)]">
                {transaction.transaction_splits.map((split, idx) => (
                  <div key={idx} className="group flex items-center justify-between py-3.5 -mx-2 px-2 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {split.contacts?.avatar_url ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                          <img src={split.contacts.avatar_url} alt={split.contacts.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center text-[var(--color-muted)] text-xs font-semibold flex-shrink-0">
                          {split.contacts?.name?.charAt(0) || <FiUser className="w-3.5 h-3.5" />}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-[var(--color-fg)] leading-none truncate">{split.contacts?.name || 'Unknown'}</span>
                        <span className={clsx(
                          "text-[10px] uppercase font-medium mt-1.5 leading-none tracking-wider",
                          split.is_settled ? "text-emerald-500" : "text-amber-500"
                        )}>
                          {split.is_settled ? 'Settled' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pl-4 flex-shrink-0">
                      <span className="text-sm font-medium tabular-nums text-[var(--color-fg)]">
                        {formatCurrency(split.amount)}
                      </span>
                      {onDeleteSplit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSplit(split.id);
                          }}
                          className="p-1.5 rounded-md text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_90%)] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Repayment For (Original Transactions) */}
          {transaction.is_repayment && transaction.transaction_repayments && (
            <div>
              <div className="card-header mb-3">Repayment For</div>
              <div className="divide-y divide-[var(--color-border)]">
                {transaction.transaction_repayments.map((repayment, idx) => {
                  const originalTx = repayment.transaction_splits?.transactions;
                  if (!originalTx) return null;
                  return (
                    <div
                      key={repayment.id || idx}
                      className="group flex items-center justify-between py-3.5 -mx-2 px-2 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors cursor-pointer"
                      onClick={() => onTransactionLinkClick && onTransactionLinkClick(originalTx.id)}
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-[var(--color-fg)] truncate">
                          {originalTx.description || 'Original Transaction'}
                        </p>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          {originalTx.date ? new Date(originalTx.date).toLocaleDateString() : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-medium tabular-nums text-[var(--color-fg)]">
                          {formatCurrency(repayment.amount)}
                        </span>
                        <span className="text-[var(--color-muted)] text-xs opacity-0 group-hover:opacity-100 transition-opacity">&#8250;</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 pb-6">
            {isIncome ? (
              !transaction.is_repayment && (
                <Button
                  variant="primary"
                  onClick={onRepaymentClick}
                  className="w-full justify-center py-2.5"
                >
                  <span className="text-sm font-medium">Mark as Repayment</span>
                </Button>
              )
            ) : (
              (!transaction.transaction_splits ||
                Math.abs(transaction.amount) > transaction.transaction_splits.reduce((sum, s) => sum + s.amount, 0) + 0.01
              ) && (
                <Button
                  variant="primary"
                  onClick={onSplitClick}
                  className="w-full justify-center py-2.5"
                >
                  <span className="text-sm font-medium">Split / Request</span>
                </Button>
              )
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
