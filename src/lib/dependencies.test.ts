import { describe, it, expect } from 'vitest';
import { weekdayDelta, shiftWeekdays, weekdayLength, dropDanglingDependencies } from '@/lib/dependencies';
import type { Project } from '@/lib/types';

describe('weekdayDelta', () => {
  it('Fri → Mon is 1', () => expect(weekdayDelta('2026-11-20', '2026-11-23')).toBe(1));
  it('Mon → Fri back is -1', () => expect(weekdayDelta('2026-11-23', '2026-11-20')).toBe(-1));
  it('same day is 0', () => expect(weekdayDelta('2026-11-18', '2026-11-18')).toBe(0));
  it('two weeks is 10', () => expect(weekdayDelta('2026-11-16', '2026-11-30')).toBe(10));
  it('snaps a Saturday start to Monday', () => expect(weekdayDelta('2026-11-21', '2026-11-24')).toBe(1));
});

describe('shiftWeekdays', () => {
  it('Fri +1 → Mon', () => expect(shiftWeekdays('2026-11-20', 1)).toBe('2026-11-23'));
  it('Mon -1 → Fri', () => expect(shiftWeekdays('2026-11-23', -1)).toBe('2026-11-20'));
  it('0 keeps a weekday', () => expect(shiftWeekdays('2026-11-18', 0)).toBe('2026-11-18'));
  it('0 snaps a Sunday', () => expect(shiftWeekdays('2026-11-22', 0)).toBe('2026-11-23'));
  it('crosses year end', () => expect(shiftWeekdays('2026-12-30', 3)).toBe('2027-01-04'));
});

describe('weekdayLength', () => {
  it('Mon–Fri is 5', () => expect(weekdayLength('2026-11-16', '2026-11-20')).toBe(5));
  it('Fri–Mon is 2', () => expect(weekdayLength('2026-11-20', '2026-11-23')).toBe(2));
  it('single day is 1', () => expect(weekdayLength('2026-11-18', '2026-11-18')).toBe(1));
});

describe('dropDanglingDependencies', () => {
  it('dropDanglingDependencies keeps valid, drops missing/self/duplicate', () => {
    const projects = [{ id: 'p', tasks: [
      { id: 't_1' },
      { id: 't_2', dependsOn: [{ taskId: 't_1', follow: true }, { taskId: 't_1', follow: false }, { taskId: 't_2', follow: true }, { taskId: 't_gone', follow: true }] },
      { id: 't_3', dependsOn: [{ taskId: 't_gone', follow: true }] },
    ] }] as unknown as Project[];
    const out = dropDanglingDependencies(projects);
    expect(out[0].tasks[1].dependsOn).toEqual([{ taskId: 't_1', follow: true }]);
    expect(out[0].tasks[2].dependsOn).toBeUndefined();
  });
});
