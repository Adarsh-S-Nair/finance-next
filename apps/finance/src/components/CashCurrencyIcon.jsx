"use client";

/**
 * CashCurrencyIcon
 *
 * A green banknote glyph for cash positions in the investments UI —
 * an actual dollar-bill shape (rectangle with a center portrait), not the
 * plain "$" text fallback. Reads clearly as "this is cash, not a tradeable
 * holding." Rendered inside the same rounded avatar treatment as holding
 * logos so rows line up.
 *
 * `currency` is accepted for future per-currency theming; the bill glyph is
 * currency-agnostic today.
 */

import { FaMoneyBillAlt } from "react-icons/fa";

export default function CashCurrencyIcon({ currency = "USD", size = 40 }) {
  void currency;
  const dim = `${size}px`;
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-success)]/25 bg-[color-mix(in_oklab,var(--color-success),transparent_88%)]"
      style={{ width: dim, height: dim }}
    >
      <FaMoneyBillAlt
        className="text-[var(--color-success)]"
        style={{ width: size * 0.5, height: size * 0.5 }}
      />
    </div>
  );
}
