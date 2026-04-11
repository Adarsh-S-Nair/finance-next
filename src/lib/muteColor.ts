/**
 * Desaturate a hex color to produce a muted, zinc-friendly tone.
 *
 * Takes any saturated hex color (e.g. #EF4444) and pulls it toward a
 * neutral midtone while preserving enough of the original hue to stay
 * distinguishable. The result fits naturally alongside zinc-based UI.
 *
 * @param hex  - 6-digit hex color (with or without '#')
 * @param amount - 0 = original color, 1 = fully gray (default 0.45)
 */
export function muteColor(hex: string, amount = 0.45): string {
  if (!hex || hex.length < 6) return '#71717a'; // zinc-500 fallback

  const raw = hex.replace('#', '');
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);

  // Perceived luminance gray point
  const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);

  // Blend toward a slightly warm neutral (not pure gray)
  const neutral = Math.round(gray * 0.85 + 140 * 0.15);

  const mix = (channel: number) => {
    const blended = Math.round(channel * (1 - amount) + neutral * amount);
    return Math.max(0, Math.min(255, blended));
  };

  const mr = mix(r);
  const mg = mix(g);
  const mb = mix(b);

  return `#${mr.toString(16).padStart(2, '0')}${mg.toString(16).padStart(2, '0')}${mb.toString(16).padStart(2, '0')}`;
}

/**
 * Mute an array of hex colors, then shift duplicates so siblings that
 * share a parent group color end up as distinct tints of the same hue.
 *
 * Use this for chart slices where multiple categories can have the
 * same base hex_color (e.g. two system categories under Loan Payments).
 */
export function dedupeAndMute(hexColors: (string | undefined | null)[]): string[] {
  // First pass: mute everything
  const muted = hexColors.map((h) => muteColor(h || '#71717a'));

  // Second pass: shift duplicates
  const seen: Record<string, number> = {};
  return muted.map((color) => {
    const key = color.toLowerCase();
    const n = seen[key] || 0;
    seen[key] = n + 1;
    if (n === 0) return color;

    // Parse and shift — alternate lighter/darker per occurrence
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const shift = n % 2 === 1 ? 35 * Math.ceil(n / 2) : -30 * Math.ceil(n / 2);
    const clamp = (v: number) => Math.max(0, Math.min(255, v + shift));
    return `#${[r, g, b].map(clamp).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  });
}
