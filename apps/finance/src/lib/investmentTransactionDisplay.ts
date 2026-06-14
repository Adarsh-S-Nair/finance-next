/**
 * Turn a stored investment transaction into a clean, human-readable title +
 * subtitle for the transactions list / details drawer.
 *
 * Plaid investment transactions arrive with verbose, redundant `name` strings
 * ("sell - sell 0.267 shares of ConocoPhillips for $92.76 each", "cash - Cash
 * dividend of $0.01 from NVDA"). We throw that string away in favour of the
 * structured `investment_details` we already persist (type/subtype/ticker/
 * security_name/quantity/price), and re-derive a tidy label from it.
 *
 * Plaid investment transaction `type` values: buy, sell, cash, fee, transfer,
 * cancel. We format the ones that carry real cash impact and fall back to a
 * cleaned-up version of the raw description for anything unexpected.
 */

export interface InvestmentDetails {
  ticker?: string | null;
  security_name?: string | null;
  security_type?: string | null;
  security_subtype?: string | null;
  quantity?: number | null;
  price?: number | null;
  fees?: number | null;
  type?: string | null;
  subtype?: string | null;
}

export interface InvestmentDisplay {
  title: string;
  subtitle: string | null;
  /** react-icons library + name, fed through <DynamicIcon>. */
  iconLib: string;
  iconName: string;
  /**
   * Background for the (white) glyph when there's no company logo. These
   * rows carry no category colour, so without an explicit fill they fall
   * back to var(--color-accent) — which is near-white in dark mode, making
   * the white icon invisible. A neutral slate stays visible in every theme.
   */
  iconBg: string;
}

/** Format a share quantity: up to 4 dp, trailing zeros trimmed (0.2670 → 0.267). */
function formatQuantity(qty: number): string {
  const rounded = Number(qty.toFixed(4));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Best human label for the security: prefer the full name, fall back to ticker. */
function securityLabel(d: InvestmentDetails): string | null {
  return d.security_name?.trim() || d.ticker?.trim() || null;
}

/**
 * Strip the redundant "{subtype} - " prefix Plaid prepends to its raw name
 * ("sell - sell 0.267 shares of …"). Used as the last-resort fallback when we
 * don't have enough structure to build a clean label ourselves.
 */
function cleanRawDescription(description: string | null | undefined): string {
  if (!description) return 'Investment transaction';
  return description.replace(/^[a-z][a-z ]*\s+-\s+/i, '').trim() || description;
}

/**
 * Derive a clean display for an investment transaction. Returns null when the
 * row isn't an investment transaction (caller should fall back to the normal
 * merchant/description rendering).
 */
export function formatInvestmentTransaction(tx: {
  transaction_source?: string | null;
  description?: string | null;
  investment_details?: InvestmentDetails | null;
}): InvestmentDisplay | null {
  if (tx.transaction_source !== 'investments') return null;

  const d = tx.investment_details || {};
  const type = (d.type || '').toLowerCase();
  const subtype = (d.subtype || '').toLowerCase();
  const label = securityLabel(d);
  const qty = typeof d.quantity === 'number' ? Math.abs(d.quantity) : null;
  const price = typeof d.price === 'number' && d.price > 0 ? d.price : null;
  const perShare = price ? `${formatPrice(price)}/share` : null;

  // Neutral fill for the white glyph when no company logo is available.
  const iconBg = '#64748b';

  const fallback = (iconLib: string, iconName: string): Core => ({
    title: cleanRawDescription(tx.description),
    subtitle: label,
    iconLib,
    iconName,
  });

  const core: Core = ((): Core => {
  switch (type) {
    case 'buy': {
      if (!label) return fallback('Fi', 'FiTrendingUp');
      return {
        title: qty ? `Bought ${formatQuantity(qty)} ${label}` : `Bought ${label}`,
        subtitle: perShare,
        iconLib: 'Fi',
        iconName: 'FiTrendingUp',
      };
    }
    case 'sell': {
      if (!label) return fallback('Fi', 'FiTrendingDown');
      return {
        title: qty ? `Sold ${formatQuantity(qty)} ${label}` : `Sold ${label}`,
        subtitle: perShare,
        iconLib: 'Fi',
        iconName: 'FiTrendingDown',
      };
    }
    case 'cash': {
      if (subtype.includes('dividend')) {
        return {
          title: label ? `Dividend · ${d.ticker?.trim() || label}` : 'Dividend',
          subtitle: 'Cash dividend',
          iconLib: 'Fi',
          iconName: 'FiDollarSign',
        };
      }
      if (subtype.includes('interest')) {
        return { title: 'Interest', subtitle: label, iconLib: 'Fi', iconName: 'FiDollarSign' };
      }
      if (subtype.includes('deposit') || subtype.includes('contribution')) {
        return { title: 'Deposit', subtitle: null, iconLib: 'Fi', iconName: 'FiArrowDownLeft' };
      }
      if (subtype.includes('withdrawal') || subtype.includes('distribution')) {
        return { title: 'Withdrawal', subtitle: null, iconLib: 'Fi', iconName: 'FiArrowUpRight' };
      }
      return fallback('Fi', 'FiDollarSign');
    }
    case 'fee': {
      return {
        title: subtype ? `Fee · ${subtype.replace(/\b\w/g, (c) => c.toUpperCase())}` : 'Fee',
        subtitle: label,
        iconLib: 'Fi',
        iconName: 'FiMinusCircle',
      };
    }
    case 'transfer': {
      return { title: label ? `Transfer · ${label}` : 'Transfer', subtitle: null, iconLib: 'Fi', iconName: 'FiRepeat' };
    }
    case 'cancel': {
      return fallback('Fi', 'FiXCircle');
    }
    default:
      return fallback('Fi', 'FiBarChart2');
  }
  })();

  return { ...core, iconBg };
}

/** The display fields the per-type switch produces, minus the shared iconBg. */
type Core = Omit<InvestmentDisplay, 'iconBg'>;
