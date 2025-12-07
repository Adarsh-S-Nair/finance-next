import { FiCalendar, FiTag, FiCreditCard, FiMapPin, FiCheckCircle, FiClock, FiActivity, FiArrowUpRight, FiShare2, FiTrash2, FiUser } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import DynamicIcon from "../DynamicIcon";
import clsx from "clsx";
import Card from "../ui/Card";
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

  // Animation variants
  const variants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={transaction.id}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.25, ease: "circOut" }}
        className="flex flex-col pb-6"
      >
        {/* Header Section - Minimalist Horizontal */}
        <div className="flex items-center justify-between px-5 py-6 border-b border-[var(--color-border)]/40 bg-[var(--color-bg)]/30">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Logo / Icon */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0 bg-[var(--color-surface)]"
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
                className="h-6 w-6 text-white"
                fallback={FiTag}
                style={{
                  display: (!DISABLE_LOGOS && transaction.icon_url) ? 'none' : 'block'
                }}
              />
            </div>

            {/* Merchant Name & Date */}
            <div className="flex flex-col min-w-0">
              <h2 className="text-base font-medium text-[var(--color-fg)] truncate">
                {transaction.merchant_name || transaction.description || 'Transaction'}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                <span>{formattedDate}</span>
                {formattedTime && (
                  <>
                    <span className="opacity-50">•</span>
                    <span>{formattedTime}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className={clsx(
            "text-lg font-medium tracking-tight whitespace-nowrap pl-4",
            isIncome ? "text-emerald-500" : "text-[var(--color-fg)]"
          )}>
            {isIncome ? '+' : ''}{formatCurrency(transaction.amount)}
          </div>
        </div>

        {/* Main Details Card */}
        <div className="px-4 space-y-6">
          <Card variant="glass" padding="none" className="overflow-hidden">
            <div className="divide-y divide-[var(--color-border)]/40">

              {/* Status Row */}
              <div className="flex items-center justify-between p-4">
                <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">Status</span>
                <div className="text-xs font-medium text-[var(--color-fg)] uppercase tracking-wider">
                  {transaction.pending ? 'Pending' : 'Posted'}
                </div>
              </div>

              {/* Category Row */}
              <div
                onClick={onCategoryClick}
                className="group flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--color-surface)]/50 transition-colors"
              >
                <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider flex-shrink-0">Category</span>
                <div className="flex items-center gap-2 group-hover:translate-x-[-2px] transition-transform min-w-0 flex-1 justify-end pl-4">
                  <div
                    className="w-2 h-2 rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10 flex-shrink-0"
                    style={{ backgroundColor: transaction.category_hex_color || 'var(--color-accent)' }}
                  />
                  <span className="text-sm text-[var(--color-fg)] truncate text-right">{transaction.category_name}</span>
                  <FiArrowUpRight className="w-3 h-3 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              </div>

              {/* Account Row */}
              {transaction.account_name && (
                <div className="flex items-center justify-between p-4">
                  <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">Account</span>
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end pl-4">
                    {institutionLogo && (
                      <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-white shadow-sm">
                        <img
                          src={`data:image/png;base64,${institutionLogo}`}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <span className="text-sm text-[var(--color-fg)] truncate text-right">
                      {transaction.account_name}
                      {transaction.accounts?.mask && <span className="text-[var(--color-muted)] opacity-70 ml-1">••{transaction.accounts.mask}</span>}
                    </span>
                  </div>
                </div>
              )}

              {/* Location Row (if present) */}
              {transaction.location && (
                <div className="flex items-center justify-between p-4">
                  <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">Location</span>
                  <span className="text-sm text-[var(--color-fg)] truncate max-w-[60%] text-right">
                    {typeof transaction.location === 'string'
                      ? transaction.location
                      : transaction.location?.address || `${transaction.location?.city || ''}, ${transaction.location?.region || ''}`.replace(/^,\s*|,\s*$/g, '') || 'Unknown'}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Reimbursement Requests (Splits) */}
          {transaction.transaction_splits && transaction.transaction_splits.length > 0 && (
            <div>
              <h3 className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2 px-1">
                Reimbursement Requests
              </h3>
              <Card variant="glass" padding="none" className="overflow-hidden">
                <div className="divide-y divide-[var(--color-border)]/40">
                  {transaction.transaction_splits.map((split, idx) => (
                    <div key={idx} className="group flex items-center justify-between p-4 hover:bg-[var(--color-surface)]/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3 min-w-0">
                        {split.contacts?.avatar_url ? (
                          <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm flex-shrink-0">
                            <img src={split.contacts.avatar_url} alt={split.contacts.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)] text-xs font-bold border border-[var(--color-border)]/50 flex-shrink-0">
                            {split.contacts?.name?.charAt(0) || <FiUser className="w-3.5 h-3.5" />}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-[var(--color-fg)] leading-none truncate">{split.contacts?.name || 'Unknown'}</span>
                          <span className={clsx(
                            "text-[10px] uppercase font-medium mt-1.5 leading-none",
                            split.is_settled ? "text-emerald-500" : "text-amber-500"
                          )}>
                            {split.is_settled ? 'Settled' : 'Pending'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pl-4 flex-shrink-0">
                        <span className="text-sm font-medium text-[var(--color-fg)]">
                          {formatCurrency(split.amount)}
                        </span>
                        {onDeleteSplit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSplit(split.id);
                            }}
                            className="p-1.5 rounded-md text-[var(--color-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Repayment For (Original Transactions) */}
          {transaction.is_repayment && transaction.transaction_repayments && (
            <div>
              <h3 className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2 px-1">
                Repayment For
              </h3>
              <Card variant="glass" padding="none" className="overflow-hidden">
                <div className="divide-y divide-[var(--color-border)]/40">
                  {transaction.transaction_repayments.map((repayment, idx) => {
                    const originalTx = repayment.transaction_splits?.transactions;
                    if (!originalTx) return null;
                    return (
                      <div
                        key={repayment.id || idx}
                        className="group flex items-center justify-between p-4 hover:bg-[var(--color-surface)]/50 transition-colors cursor-pointer"
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
                          <span className="text-sm font-medium text-[var(--color-fg)]">
                            {formatCurrency(repayment.amount)}
                          </span>
                          <FiArrowUpRight className="w-3.5 h-3.5 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2">
            {isIncome ? (
              !transaction.is_repayment && (
                <Button
                  variant="primary"
                  onClick={onRepaymentClick}
                  className="w-full justify-center gap-2 py-3 font-medium shadow-sm hover:translate-y-[-1px] transition-transform"
                >
                  <FiCheckCircle className="w-4 h-4" />
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
                  className="w-full justify-center gap-2 py-2.5 font-medium shadow-sm hover:translate-y-[-1px] transition-transform"
                >
                  <FiShare2 className="w-4 h-4" />
                  Split / Request
                </Button>
              )
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
