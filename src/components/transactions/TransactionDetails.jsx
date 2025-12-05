import { FiCalendar, FiTag, FiCreditCard, FiMapPin, FiCheckCircle, FiClock, FiActivity, FiArrowUpRight, FiArrowDownLeft, FiShare2 } from "react-icons/fi";
import { useState } from "react";
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

export default function TransactionDetails({ transaction, onCategoryClick, onSplitClick, onRepaymentClick }) {

  if (!transaction) return null;

  const isIncome = transaction.amount > 0;
  const statusColor = transaction.pending ? "text-amber-500" : "text-emerald-500";
  const StatusIcon = transaction.pending ? FiClock : FiCheckCircle;

  // Format date - shorter format to prevent wrapping
  // Use UTC components to ensure date stays consistent regardless of local timezone
  // Prefer the new 'date' column if available, otherwise fall back to datetime
  const dateToFormat = transaction.date || transaction.datetime;

  const formattedDate = dateToFormat
    ? new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(dateToFormat))
    : 'Unknown Date';

  // Format time if available (only if datetime is present)
  const formattedTime = transaction.datetime
    ? new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      timeZone: 'UTC' // Assuming stored datetime is UTC
    }).format(new Date(transaction.datetime))
    : null;

  // Format authorized date (Posted Date)
  const formattedPostedDate = transaction.authorized_date
    ? new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(transaction.authorized_date))
    : null;

  // Format location
  const locationString = typeof transaction.location === 'string'
    ? transaction.location
    : transaction.location?.address ||
    `${transaction.location?.city || ''}, ${transaction.location?.region || ''}`.replace(/^,\s*|,\s*$/g, '') ||
    'Location available';

  // Check for institution logo
  // The API returns transaction.accounts.institutions.logo
  // But sometimes it might be nested differently depending on the join
  // Let's check transaction.accounts?.institutions?.logo based on the API route
  const institutionLogo = transaction.accounts?.institutions?.logo;

  return (
    <div className="flex flex-col">
      {/* Header Section */}
      <div className="flex flex-col items-center justify-center pt-6 pb-6 px-4">
        {/* Logo / Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm border border-[var(--color-border)]/50 mb-4 bg-[var(--color-surface)]"
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
            className="h-7 w-7 text-white"
            fallback={FiTag}
            style={{
              display: (!DISABLE_LOGOS && transaction.icon_url) ? 'none' : 'block'
            }}
          />
        </div>

        {/* Amount */}
        <div className="flex items-center gap-2 mb-1">
          <div className={clsx(
            "text-2xl font-bold tracking-tight",
            isIncome ? "text-emerald-500" : "text-[var(--color-fg)]"
          )}>
            {isIncome ? '+' : ''}{formatCurrency(transaction.amount)}
          </div>
        </div>

        {/* Merchant Name */}
        <h2 className="text-sm font-medium text-[var(--color-muted)] text-center max-w-[80%] truncate">
          {transaction.merchant_name || transaction.description || 'Transaction'}
        </h2>
      </div>

      {/* Details List */}
      <div className="px-4 pb-6 space-y-4">
        <Card variant="default" padding="none" className="overflow-hidden">
          <div className="divide-y divide-[var(--color-border)]/40">
            {/* Status */}
            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)]">
                  <FiActivity className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-[var(--color-muted)]">Status</span>
              </div>
              <div className={clsx("flex items-center gap-1.5 text-sm", statusColor)}>
                <StatusIcon className="w-3.5 h-3.5" />
                <span>{transaction.pending ? 'Pending' : 'Posted'}</span>
              </div>
            </div>

            {/* Category */}
            {transaction.category_name && (
              <div
                onClick={onCategoryClick}
                className="group flex items-center justify-between p-3.5 cursor-pointer hover:bg-[var(--color-surface)]/50 transition-colors gap-4"
              >
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors">
                    <FiTag className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-muted)]">Category</span>
                </div>
                <div className="flex items-center group-hover:translate-x-[-2px] transition-transform min-w-0 text-right">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0 mr-2"
                    style={{ backgroundColor: transaction.category_hex_color || 'var(--color-accent)' }}
                  />
                  <span className="text-sm text-[var(--color-fg)] truncate">{transaction.category_name}</span>
                  <div className="w-0 overflow-hidden group-hover:w-5 transition-[width] duration-200 ease-out flex-shrink-0 flex justify-end">
                    <FiArrowUpRight className="w-3.5 h-3.5 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                </div>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)]">
                  <FiCalendar className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-[var(--color-muted)]">Date</span>
              </div>
              <span className="text-sm text-[var(--color-fg)] text-right max-w-[60%] whitespace-nowrap">
                {formattedDate}
              </span>
            </div>

            {/* Time (if available) */}
            {formattedTime && (
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)]">
                    <FiClock className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-muted)]">Time</span>
                </div>
                <span className="text-sm text-[var(--color-fg)] text-right max-w-[60%] whitespace-nowrap">
                  {formattedTime}
                </span>
              </div>
            )}

            {/* Posted Date (if available and different from Date) */}
            {formattedPostedDate && formattedPostedDate !== formattedDate && (
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)]">
                    <FiCheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-muted)]">Posted Date</span>
                </div>
                <span className="text-sm text-[var(--color-fg)] text-right max-w-[60%] whitespace-nowrap">
                  {formattedPostedDate}
                </span>
              </div>
            )}

            {/* Account */}
            {transaction.account_name && (
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)]">
                    <FiCreditCard className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-muted)]">Account</span>
                </div>
                <div className="flex items-center gap-2">
                  {institutionLogo && (
                    <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 bg-white">
                      <img
                        src={`data:image/png;base64,${institutionLogo}`}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    </div>
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
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)]">
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
        </Card>

        {/* Actions */}
        {isIncome ? (
          <div className="flex justify-center pt-2">
            <Button
              variant="minimal"
              onClick={onRepaymentClick}
              className="gap-2"
            >
              <FiCheckCircle className="w-4 h-4" />
              Mark as Repayment
            </Button>
          </div>
        ) : (
          <div className="flex justify-center pt-2">
            <Button
              variant="minimal"
              onClick={onSplitClick}
              className="gap-2"
            >
              <FiShare2 className="w-4 h-4" />
              Split / Request
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
