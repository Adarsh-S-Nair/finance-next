import React, { memo } from 'react';
import { FiTag } from 'react-icons/fi';
import DynamicIcon from '../DynamicIcon';
import { formatCurrency as formatCurrencyBase } from '../../lib/formatCurrency';
import {
  formatInvestmentTransaction,
  type InvestmentDetails,
} from '../../lib/investmentTransactionDisplay';

const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

const formatCurrency = (amount: number) => formatCurrencyBase(amount, true);

type TransactionSplit = {
  is_settled?: boolean | null;
};

// Loose shape — this component accepts rows from multiple callers
// (transactions list, account drilldown, search results) whose exact
// projections vary. Typing every optional field would be more churn than
// signal; we keep the fields we actually read explicit.
export type TransactionRowData = {
  id: string | number;
  amount: number;
  date?: string | null;
  description?: string | null;
  merchant_name?: string | null;
  icon_url?: string | null;
  category_name?: string | null;
  category_hex_color?: string | null;
  category_icon_lib?: string | null;
  category_icon_name?: string | null;
  account_name?: string | null;
  pending?: boolean | null;
  is_repayment?: boolean | null;
  is_unmatched_transfer?: boolean | null;
  is_unmatched_payment?: boolean | null;
  transaction_splits?: TransactionSplit[] | null;
  transaction_source?: string | null;
  investment_details?: InvestmentDetails | null;
};

type Props = {
  transaction: TransactionRowData;
  onTransactionClick: (transaction: TransactionRowData) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  compact?: boolean;
  showDate?: boolean;
  index?: number;
  groupIndex?: number;
};

const TransactionRow = memo(function TransactionRow({
  transaction,
  onTransactionClick,
  selectable,
  selected,
  onSelect,
  compact,
  showDate = false,
}: Props) {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const splits = transaction.transaction_splits ?? [];
  const hasSplits = splits.length > 0;
  const hasSettledSplit = hasSplits && splits.some((s) => s.is_settled);
  const hasUnsettledSplit = hasSplits && splits.some((s) => !s.is_settled);

  const showLogo = !DISABLE_LOGOS && !!transaction.icon_url && !logoFailed;

  // Investment transactions carry structured details; re-derive a clean
  // title/subtitle/icon from them instead of rendering Plaid's verbose
  // raw description ("sell - sell 0.267 shares of ConocoPhillips …").
  const investment = formatInvestmentTransaction(transaction);
  const title = investment?.title || transaction.merchant_name || transaction.description || 'Transaction';
  const subtitle = investment ? investment.subtitle : transaction.category_name;

  const needsReview =
    !transaction.is_repayment &&
    (transaction.is_unmatched_transfer ||
      transaction.is_unmatched_payment ||
      transaction.account_name === 'Unknown Account');

  return (
    <div
      data-transaction-item
      data-transaction-id={transaction.id}
      className={`group relative flex items-center justify-between ${compact ? 'py-2 px-3' : 'py-4 -mx-2 px-2 md:-mx-3 md:px-3'} hover:bg-[var(--color-surface-alt)]/40 rounded-lg transition-all duration-200 cursor-pointer ${selected ? 'bg-[var(--color-surface)]/30' : ''} ${needsReview ? 'pl-4 md:pl-5' : ''}`}
      onClick={() => {
        if (selectable && onSelect) {
          onSelect(!selected);
        } else {
          onTransactionClick(transaction);
        }
      }}
    >
      {/* Left-edge accent bar — signals the row needs the user's
          attention (unmatched transfer, unknown account, etc.).
          Replaces the old inline yellow alert circle, which was noisy
          and competed with the category text. */}
      {needsReview && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[var(--color-danger)]"
        />
      )}

      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="relative">
          <div
            className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 transition-all duration-300 ${selected ? 'ring-2 ring-[var(--color-accent)]/20' : ''}`}
            style={{
              backgroundColor: showLogo
                ? 'transparent'
                : (investment?.iconBg || transaction.category_hex_color || 'var(--color-accent)')
            }}
          >
            {showLogo ? (
              <img
                src={transaction.icon_url as string}
                alt={transaction.merchant_name || transaction.description || 'Transaction'}
                className="w-full h-full object-cover rounded-full"
                loading="lazy"
                decoding="async"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <DynamicIcon
                iconLib={investment?.iconLib || transaction.category_icon_lib}
                iconName={investment?.iconName || transaction.category_icon_name}
                className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-white`}
                fallback={FiTag}
                style={{ strokeWidth: 2.5 }}
              />
            )}
          </div>
          {selected && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--color-accent)] rounded-full flex items-center justify-center border-2 border-[var(--color-bg)] animate-scale-in">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 mr-4">
          <div className="font-medium text-[var(--color-fg)] truncate text-sm transition-colors">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-[var(--color-muted)] mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`font-medium text-sm tabular-nums ${transaction.amount > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-fg)]'}`}>
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

        {(transaction.is_repayment || hasSettledSplit) && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] mt-0.5">
            {transaction.amount > 0 ? 'REIMBURSEMENT' : 'REIMBURSED'}
          </div>
        )}

        {!transaction.is_repayment && !hasSettledSplit && transaction.amount < 0 && hasUnsettledSplit && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] mt-0.5">
            REQUESTED
          </div>
        )}
      </div>
    </div>
  );
});

TransactionRow.displayName = 'TransactionRow';

export default TransactionRow;
