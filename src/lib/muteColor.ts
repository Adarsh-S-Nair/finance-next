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
