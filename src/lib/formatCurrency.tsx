import React from "react";

/**
 * Format a number as a currency string (plain text).
 * Returns e.g. "$1,234" or "$1,234.56"
 */
export function formatCurrency(amount: number, cents = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(amount);
}

/**
 * Render a currency amount as JSX with a smaller, lighter $ sign
 * separated from the number. Used for display in UI components.
 *
 * @param amount - The numeric amount
 * @param options.cents - Show cents (default: false)
 * @param options.dollarClassName - Extra classes for the $ sign
 * @param options.amountClassName - Extra classes for the number
 */
export function CurrencyAmount({
  amount,
  cents = false,
  dollarClassName = "",
  amountClassName = "",
}: {
  amount: number;
  cents?: boolean;
  dollarClassName?: string;
  amountClassName?: string;
}) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(Math.abs(amount));

  const isNegative = amount < 0;

  return (
    <span className="inline-flex items-baseline">
      {isNegative && <span>-</span>}
      <span className={`text-[0.65em] font-normal opacity-50 mr-0.5 ${dollarClassName}`}>
        $
      </span>
      <span className={amountClassName}>{formatted}</span>
    </span>
  );
}
