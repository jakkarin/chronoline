import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import { getWeekRangeLabel, snapToWeekday, nextWeekday } from '@/lib/date-utils';

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
