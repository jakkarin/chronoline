import { describe, it, expect } from 'vitest';
import { visibleRange, detectOverflow, stopAtEdge, MAX_WEEKS } from '@/lib/timeline-overflow';
import type { Project } from '@/lib/types';

const ps = (end: string) => [{ id: 'p', tasks: [
  { id: 'ok', startDate: '2026-05-04', endDate: '2026-05-08' },
  { id: 'late', startDate: '2026-07-02', endDate: end },
] }] as unknown as Project[];
const range = { first: '2026-04-27', last: '2026-07-03' };

describe('timeline overflow', () => {
  it('visibleRange', () => expect(visibleRange('2026-04-27', 10)).toEqual(range));
  it('visibleRange anchors to Monday', () => expect(visibleRange('2026-04-29', 10)).toEqual(range));
  it('no overflow returns null', () => expect(detectOverflow(ps('2026-07-03'), '2026-04-27', 10)).toBeNull());
  it('reports tasks and weeks needed', () =>
    expect(detectOverflow(ps('2026-07-08'), '2026-04-27', 10)).toEqual({ taskIds: ['late'], weeksNeeded: 11 }));
  it('weeksNeeded is not capped', () =>
    expect(detectOverflow(ps('2027-06-04'), '2026-04-27', 10)?.weeksNeeded).toBeGreaterThan(MAX_WEEKS));
  it('stopAtEdge keeps length', () =>
    expect(stopAtEdge({ startDate: '2026-07-02', endDate: '2026-07-08' }, range))
      .toEqual({ startDate: '2026-06-29', endDate: '2026-07-03' }));
  it('stopAtEdge longer than grid starts at first', () =>
    expect(stopAtEdge({ startDate: '2026-01-05', endDate: '2026-08-07' }, range))
      .toEqual({ startDate: '2026-04-27', endDate: '2026-07-03' }));
  it('MAX_WEEKS is 52', () => expect(MAX_WEEKS).toBe(52));
});
