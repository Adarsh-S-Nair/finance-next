export interface Insight {
  id: string;
  priority: number;
  message: string;
  tone: 'positive' | 'negative' | 'neutral';
  feature?: string;
}
