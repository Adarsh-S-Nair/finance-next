"use client";

/**
 * CashCurrencyIcon
 *
 * A money/banknote glyph used for cash positions in the investments UI,
 * replacing the plain "$" text fallback. Reads better as "this is cash,
 * not a tradeable holding." Rendered inside the same rounded avatar
 * treatment as holding logos so rows line up.
 *
 * Currencies with a recognizable symbol icon get it (USD/EUR/GBP/…);
 * everything else falls back to a generic banknote.
 */

import {
  PiCurrencyDollarFill,
  PiCurrencyEurFill,
  PiCurrencyGbpFill,
  PiCurrencyJpyFill,
  PiCurrencyInrFill,
  PiCurrencyCnyFill,
  PiMoneyWavyFill,
} from "react-icons/pi";

const CURRENCY_ICONS = {
  USD: PiCurrencyDollarFill,
  EUR: PiCurrencyEurFill,
  GBP: PiCurrencyGbpFill,
  JPY: PiCurrencyJpyFill,
  INR: PiCurrencyInrFill,
  CNY: PiCurrencyCnyFill,
};

export default function CashCurrencyIcon({ currency = "USD", size = 40 }) {
  const dim = `${size}px`;
  const Icon = CURRENCY_ICONS[(currency || "").toUpperCase()] || PiMoneyWavyFill;
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-success)]/25 bg-[color-mix(in_oklab,var(--color-success),transparent_88%)]"
      style={{ width: dim, height: dim }}
    >
      <Icon
        className="text-[var(--color-success)]"
        style={{ width: size * 0.5, height: size * 0.5 }}
      />
    </div>
  );
}
