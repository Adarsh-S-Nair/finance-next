import React, { memo } from 'react';
import { FiTag } from 'react-icons/fi';
import DynamicIcon from '../DynamicIcon';

const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const TransactionRow = memo(function TransactionRow({ transaction, onTransactionClick, selectable, selected, onSelect, compact, showDate = false }) {
  return (
    <div
      data-transaction-item
      data-transaction-id={transaction.id}
      className={`group relative flex items-center justify-between ${compact ? 'py-3 px-4' : 'py-4 px-5'} hover:bg-[var(--color-surface)]/50 transition-all duration-300 ease-out cursor-pointer hover:scale-[1.005] active:scale-[0.995] ${selected ? 'bg-[var(--color-surface)]/30' : ''}`}
      onClick={() => {
        if (selectable && onSelect) {
          onSelect(!selected);
        } else {
          onTransactionClick(transaction);
        }
      }}
    >

      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="relative">
          <div
            className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm border transition-all duration-300 ${selected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)]/20'}`}
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
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  // Fallback to category icon if image fails to load
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
              className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-white`}
              fallback={FiTag}
              style={{
                display: (!DISABLE_LOGOS && transaction.icon_url) ? 'none' : 'block'
              }}
            />
          </div>
          {selected && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--color-accent)] rounded-full flex items-center justify-center border-2 border-[var(--color-bg)] animate-scale-in shadow-sm">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 mr-4">
          <div className="font-medium text-[var(--color-fg)] truncate text-sm transition-colors">
            {transaction.merchant_name || transaction.description || 'Transaction'}
          </div>
          {transaction.category_name && (
            <div className="text-xs text-[var(--color-muted)] mt-0.5 truncate">
              {transaction.category_name}
            </div>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`font-semibold text-sm tabular-nums ${transaction.amount > 0 ? 'text-emerald-500' : 'text-[var(--color-fg)]'}`}>
          {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
        </div>
        {showDate && transaction.date && (
          <div className="text-xs text-[var(--color-muted)] mt-0.5">
            {new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
          </div>
        )}

        {transaction.pending && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] mt-0.5">
            Pending
          </div>
        )}
      </div>
    </div>
  );
});

TransactionRow.displayName = 'TransactionRow';

export default TransactionRow;
