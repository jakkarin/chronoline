import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import { getWeekRangeLabel, snapToWeekday, nextWeekday, generateColumns, barColumnRange } from '@/lib/date-utils';

describe('getWeekRangeLabel', () => {
  it('formats a Mon–Fri range', () => {
    expect(getWeekRangeLabel(parseISO('2026-11-30'))).toBe('30 Nov - 4 Dec 2026');
  });
  it('puts the end year on a week crossing new year', () => {
    expect(getWeekRangeLabel(parseISO('2026-12-28'))).toBe('28 Dec - 1 Jan 2027');
  });
});

describe('snapToWeekday', () => {
  it('snaps Saturday to Monday', () => expect(snapToWeekday('2026-11-21')).toBe('2026-11-23'));
  it('snaps Sunday to Monday', () => expect(snapToWeekday('2026-11-22')).toBe('2026-11-23'));
  it('keeps a weekday', () => expect(snapToWeekday('2026-11-18')).toBe('2026-11-18'));
});

describe('nextWeekday', () => {
  it('Friday → Monday', () => expect(nextWeekday('2026-11-20')).toBe('2026-11-23'));
  it('Wednesday → Thursday', () => expect(nextWeekday('2026-11-18')).toBe('2026-11-19'));
  it('crosses year end', () => expect(nextWeekday('2026-12-31')).toBe('2027-01-01'));
});

describe('barColumnRange', () => {
  // Mon 16 Nov … Fri 27 Nov 2026 → indices 0–9 (16→0 … 20→4, 23→5 … 27→9)
  const cols = generateColumns('2026-11-16', 2);

  it('maps weekday dates inside the grid to their columns', () =>
    expect(barColumnRange('2026-11-17', '2026-11-24', cols)).toEqual({ startCol: 1, endCol: 6 }));
  it('moves a Saturday start to the next Monday column', () =>
    expect(barColumnRange('2026-11-21', '2026-11-25', cols)).toEqual({ startCol: 5, endCol: 7 }));
  it('moves a Sunday end to the previous Friday column', () =>
    expect(barColumnRange('2026-11-17', '2026-11-22', cols)).toEqual({ startCol: 1, endCol: 4 }));
  it('clamps a start before the grid to the first column', () =>
    expect(barColumnRange('2026-11-02', '2026-11-18', cols)).toEqual({ startCol: 0, endCol: 2 }));
  it('clamps an end after the grid to the last column', () =>
    expect(barColumnRange('2026-11-26', '2026-12-15', cols)).toEqual({ startCol: 8, endCol: 9 }));
  it('returns null when the task is entirely before the grid', () =>
    expect(barColumnRange('2026-11-02', '2026-11-13', cols)).toBeNull());
  it('returns null when the task is entirely after the grid', () =>
    expect(barColumnRange('2026-11-30', '2026-12-04', cols)).toBeNull());
  it('returns null for a weekend-only task', () =>
    expect(barColumnRange('2026-11-21', '2026-11-22', cols)).toBeNull());
  it('returns null when a date is missing', () =>
    expect(barColumnRange('', '2026-11-18', cols)).toBeNull());
});
