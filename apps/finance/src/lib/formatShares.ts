/**
 * Format a share/holding quantity with adaptive precision.
 * Sub-unit holdings (e.g. fractional crypto) get more digits; whole-unit
 * holdings get tighter output. Null/NaN renders as "—".
 */
export function formatShares(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const num = Number(value);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: num < 1 ? 4 : 2,
    maximumFractionDigits: num < 1 ? 6 : 4,
  });
}
