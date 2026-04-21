export interface Insight {
  id: string;
  title: string;
  priority: number;
  message: string;
  tone: 'positive' | 'negative' | 'neutral';
  feature?: string;
}

/** Format a number with commas (e.g. 18032 → "18,032") */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
