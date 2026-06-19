/**
 * @jest-environment node
 */
import { resolveChartStartISO } from '../../../lib/netWorth/chartRange';

// For today = 2026-06-19 and maxDays = 365, the lookback window starts at
// today - 364 days = 2025-06-20.
const TODAY = '2026-06-19';
const LOOKBACK_365 = '2025-06-20';

describe('resolveChartStartISO', () => {
  describe('holdings path (the one that used to draw a full year)', () => {
    it('floors the start at the first account connection when it is recent', () => {
      // Regression: a user who connected last month should NOT see a year of
      // reconstructed history. Start should be the connection date.
      const start = resolveChartStartISO({
        todayISO: TODAY,
        maxDays: 365,
        hasHoldings: true,
        earliestSnapshotISO: '2026-04-09',
        earliestConnectionISO: '2026-04-08',
      });
      expect(start).toBe('2026-04-08');
    });

    it('still respects the lookback cap when the connection is older than maxDays', () => {
      const start = resolveChartStartISO({
        todayISO: TODAY,
        maxDays: 365,
        hasHoldings: true,
        earliestSnapshotISO: '2024-02-01',
        earliestConnectionISO: '2024-01-01',
      });
      expect(start).toBe(LOOKBACK_365);
    });

    it('falls back to the lookback window when connection date is unknown', () => {
      const start = resolveChartStartISO({
        todayISO: TODAY,
        maxDays: 365,
        hasHoldings: true,
        earliestSnapshotISO: '2025-09-21',
        earliestConnectionISO: null,
      });
      expect(start).toBe(LOOKBACK_365);
    });

    it('honors a smaller maxDays window', () => {
      // today - 29 days = 2026-05-21
      const start = resolveChartStartISO({
        todayISO: TODAY,
        maxDays: 30,
        hasHoldings: true,
        earliestSnapshotISO: '2026-04-09',
        earliestConnectionISO: '2026-04-08',
      });
      expect(start).toBe('2026-05-21');
    });
  });

  describe('no-holdings path (snapshot-driven)', () => {
    it('starts at the first snapshot when it is within the window', () => {
      const start = resolveChartStartISO({
        todayISO: TODAY,
        maxDays: 365,
        hasHoldings: false,
        earliestSnapshotISO: '2025-09-21',
        earliestConnectionISO: null,
      });
      expect(start).toBe('2025-09-21');
    });

    it('never starts before the connection floor', () => {
      const start = resolveChartStartISO({
        todayISO: TODAY,
        maxDays: 365,
        hasHoldings: false,
        earliestSnapshotISO: '2026-03-01',
        earliestConnectionISO: '2026-04-08',
      });
      expect(start).toBe('2026-04-08');
    });
  });
});
