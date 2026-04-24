export interface InsightAction {
  /** Button label — shown to the right of the message. */
  label: string;
  /** Destination URL. Rendered as a Next.js link. */
  href: string;
}

export interface Insight {
  id: string;
  title: string;
  priority: number;
  message: string;
  tone: 'positive' | 'negative' | 'neutral';
  feature?: string;
  /**
   * Optional call-to-action shown as a pill button inside the insight
   * card. Used e.g. for the "view unmatched transfers" shortcut.
   */
  action?: InsightAction;
}

/** Format a number with commas (e.g. 18032 → "18,032") */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
