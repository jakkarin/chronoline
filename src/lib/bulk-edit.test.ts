import { describe, it, expect } from 'vitest';
import { bulkStartDatePatch, bulkPickerMonth } from '@/lib/bulk-edit';
import type { Project } from '@/lib/types';

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

describe('bulkPickerMonth', () => {
  const projects = [
    { tasks: [{ id: 't_1', startDate: '2026-05-12' }, { id: 't_2', startDate: '2026-04-28' }] },
    { tasks: [{ id: 't_3', startDate: '2026-06-01' }, { id: 't_4', startDate: '' }] },
  ] as unknown as Project[];

  it('opens on the earliest start date among the selected tasks', () =>
    expect(bulkPickerMonth(projects, ['t_1', 't_3', 't_2'], '2026-01-05')).toBe('2026-04-28'));
  it('ignores selected tasks without a start date', () =>
    expect(bulkPickerMonth(projects, ['t_4', 't_3'], '2026-01-05')).toBe('2026-06-01'));
  it('falls back to the timeline start when no selected task has a start date', () =>
    expect(bulkPickerMonth(projects, ['t_4'], '2026-01-05')).toBe('2026-01-05'));
});
