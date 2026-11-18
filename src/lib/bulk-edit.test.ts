import { describe, it, expect } from 'vitest';
import { bulkStartDatePatch } from '@/lib/bulk-edit';

const t = (startDate: string, endDate: string) => ({ startDate, endDate });

describe('bulkStartDatePatch', () => {
  it('keeps end when it is after the new start', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-27'), '2026-11-18'))
      .toEqual(t('2026-11-18', '2026-11-27')));
  it('keeps end when it equals the new start', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-18'), '2026-11-18'))
      .toEqual(t('2026-11-18', '2026-11-18')));
  it('pushes end to the next weekday when start passes it', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-17'), '2026-11-18'))
      .toEqual(t('2026-11-18', '2026-11-19')));
  it('pushes end from Friday start to Monday', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-17'), '2026-11-20'))
      .toEqual(t('2026-11-20', '2026-11-23')));
  it('snaps a weekend date to Monday', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-17'), '2026-11-21'))
      .toEqual(t('2026-11-23', '2026-11-24')));
  it('snaps a weekend date and keeps a later end', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-27'), '2026-11-22'))
      .toEqual(t('2026-11-23', '2026-11-27')));
  it('treats an empty end as before start', () =>
    expect(bulkStartDatePatch(t('', ''), '2026-11-18'))
      .toEqual(t('2026-11-18', '2026-11-19')));
});
