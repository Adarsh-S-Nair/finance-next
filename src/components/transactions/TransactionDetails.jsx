import { FiCalendar, FiTag, FiCreditCard, FiMapPin, FiCheckCircle, FiClock, FiActivity } from "react-icons/fi";
import DynamicIcon from "../DynamicIcon";
import clsx from "clsx";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

export default function TransactionDetails({ transaction, onCategoryClick }) {
  if (!transaction) return null;

  const isIncome = transaction.amount > 0;
  const statusColor = transaction.pending ? "text-amber-500" : "text-emerald-500";
  const StatusIcon = transaction.pending ? FiClock : FiCheckCircle;

  // Format date - shorter format to prevent wrapping
  const formattedDate = transaction.datetime ? new Date(transaction.datetime).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }) : 'Unknown Date';

  // Format location
  const locationString = typeof transaction.location === 'string'
    ? transaction.location
    : transaction.location?.address ||
    `${transaction.location?.city || ''}, ${transaction.location?.region || ''}`.replace(/^,\s*|,\s*$/g, '') ||
    'Location available';

  return (
    <div className="flex flex-col h-full">
      {/* Header Section */}
      <div className="flex flex-col items-center justify-center pt-8 pb-8 px-4">
        {/* Logo / Icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden shadow-lg border-4 border-[var(--color-surface)] mb-6"
          style={{
            backgroundColor: (!DISABLE_LOGOS && transaction.icon_url)
              ? 'var(--color-surface)'
              : (transaction.category_hex_color || 'var(--color-accent)')
          }}
        >
          {(!DISABLE_LOGOS && transaction.icon_url) ? (
            <img
              src={transaction.icon_url}
              alt={transaction.merchant_name || transaction.description || 'Transaction'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                const fallbackIcon = e.target.nextSibling;
                if (fallbackIcon) {
                  fallbackIcon.style.display = 'block';
                }
              }}
            />
          ) : null}
          <DynamicIcon
            iconLib={transaction.category_icon_lib}
            iconName={transaction.category_icon_name}
            className="h-8 w-8 text-white"
            fallback={FiTag}
            style={{
              display: (!DISABLE_LOGOS && transaction.icon_url) ? 'none' : 'block'
            }}
          />
        </div>

        {/* Amount */}
        <div className={clsx(
          "text-3xl font-semibold tracking-tight mb-2",
          isIncome ? "text-emerald-500" : "text-[var(--color-fg)]"
        )}>
          {isIncome ? '+' : ''}{formatCurrency(transaction.amount)}
        </div>

        {/* Merchant Name */}
        <h2 className="text-base font-medium text-[var(--color-muted)] text-center max-w-[80%] truncate">
          {transaction.merchant_name || transaction.description || 'Transaction'}
        </h2>
      </div>

      {/* Details List */}
      <div className="flex-1 px-4 pb-6">
        <div className="bg-[var(--color-surface)]/40 rounded-2xl border border-[var(--color-border)]/50 overflow-hidden">
          {/* Status */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-muted)]">
                <FiActivity className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Status</span>
            </div>
            <div className={clsx("flex items-center gap-1.5 text-sm font-medium", statusColor)}>
              <StatusIcon className="w-3.5 h-3.5" />
              <span>{transaction.pending ? 'Pending' : 'Posted'}</span>
            </div>
          </div>

          {/* Category */}
          {transaction.category_name && (
            <div
              onClick={onCategoryClick}
              className="group flex items-center justify-between p-4 border-b border-[var(--color-border)]/50 cursor-pointer hover:bg-[var(--color-surface)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors">
                  <FiTag className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-[var(--color-muted)]">Category</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: transaction.category_hex_color || 'var(--color-accent)' }}
                />
                <span className="text-sm text-[var(--color-fg)]">{transaction.category_name}</span>
              </div>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-muted)]">
                <FiCalendar className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Date</span>
            </div>
            <span className="text-sm text-[var(--color-fg)] text-right max-w-[60%] whitespace-nowrap">
              {formattedDate}
            </span>
          </div>

          {/* Account */}
          {transaction.account_name && (
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-muted)]">
                  <FiCreditCard className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-[var(--color-muted)]">Account</span>
              </div>
              <div className="flex items-center gap-2">
                {transaction.accounts?.institutions?.logo && (
                  <img
                    src={transaction.accounts.institutions.logo}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover"
                  />
                )}
                <span className="text-sm text-[var(--color-fg)]">
                  {transaction.account_name}
                  {transaction.accounts?.mask && <span className="text-[var(--color-muted)] ml-1">••{transaction.accounts.mask}</span>}
                </span>
              </div>
            </div>
          )}

          {/* Location */}
          {transaction.location && (
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-muted)]">
                  <FiMapPin className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-[var(--color-muted)]">Location</span>
              </div>
              <span className="text-sm text-[var(--color-fg)] text-right max-w-[50%] truncate">
                {locationString}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
