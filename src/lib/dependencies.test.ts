import { describe, it, expect } from 'vitest';
import { weekdayDelta, shiftWeekdays, weekdayLength, dropDanglingDependencies, cascadeFollowers, wouldCreateCycle, canLink, removeReferences } from '@/lib/dependencies';
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

const mk = (id: string, startDate: string, endDate: string, dependsOn?: { taskId: string; follow: boolean }[]) =>
  ({ id, startDate, endDate, ...(dependsOn ? { dependsOn } : {}) });
const proj = (id: string, tasks: ReturnType<typeof mk>[]) => ({ id, tasks }) as unknown as Project;
const end = (oldEnd: string, newEnd: string) => ({ oldEnd, newEnd });

describe('cascadeFollowers', () => {
  // A 16–17 Nov, B follows A 18–19, C follows B 20–23
  const chain = () => [proj('p', [
    mk('A', '2026-11-16', '2026-11-17'),
    mk('B', '2026-11-18', '2026-11-19', [{ taskId: 'A', follow: true }]),
    mk('C', '2026-11-20', '2026-11-23', [{ taskId: 'B', follow: true }]),
  ])];

  it('cascade chain A→B→C moves both by parent delta', () => {
    const r = cascadeFollowers(chain(), new Map([['A', end('2026-11-17', '2026-11-20')]]), new Set());
    expect(r.get('B')).toEqual({ startDate: '2026-11-23', endDate: '2026-11-24' });
    expect(r.get('C')).toEqual({ startDate: '2026-11-25', endDate: '2026-11-26' });
  });

  it('cascade moves earlier too', () => {
    const r = cascadeFollowers(chain(), new Map([['A', end('2026-11-17', '2026-11-13')]]), new Set());
    expect(r.get('B')).toEqual({ startDate: '2026-11-16', endDate: '2026-11-17' });
  });

  it('cascade skips follow:false', () => {
    const ps = [proj('p', [mk('A', '2026-11-16', '2026-11-17'), mk('B', '2026-11-18', '2026-11-19', [{ taskId: 'A', follow: false }])])];
    expect(cascadeFollowers(ps, new Map([['A', end('2026-11-17', '2026-11-20')]]), new Set()).size).toBe(0);
  });

  it('cascade stops at locked task', () => {
    const r = cascadeFollowers(chain(), new Map([['A', end('2026-11-17', '2026-11-20')]]), new Set(['B']));
    expect(r.has('B')).toBe(false);
    expect(r.has('C')).toBe(false);
  });

  it('diamond uses largest delta once', () => {
    const ps = [proj('p', [
      mk('A', '2026-11-16', '2026-11-17'), mk('B', '2026-11-16', '2026-11-17'),
      mk('C', '2026-11-18', '2026-11-18', [{ taskId: 'A', follow: true }, { taskId: 'B', follow: true }]),
    ])];
    const r = cascadeFollowers(ps, new Map([['A', end('2026-11-17', '2026-11-19')], ['B', end('2026-11-17', '2026-11-24')]]), new Set());
    expect(r.get('C')).toEqual({ startDate: '2026-11-25', endDate: '2026-11-25' });
  });

  it('cycle in data does not loop', () => {
    const ps = [proj('p', [
      mk('A', '2026-11-16', '2026-11-17', [{ taskId: 'B', follow: true }]),
      mk('B', '2026-11-18', '2026-11-19', [{ taskId: 'A', follow: true }]),
    ])];
    const r = cascadeFollowers(ps, new Map([['A', end('2026-11-17', '2026-11-18')]]), new Set());
    expect(r.get('B')).toEqual({ startDate: '2026-11-19', endDate: '2026-11-20' });
    expect(r.has('A')).toBe(false);
  });

  it('cross-project follower moves', () => {
    const ps = [proj('p1', [mk('A', '2026-11-16', '2026-11-17')]), proj('p2', [mk('X', '2026-11-18', '2026-11-18', [{ taskId: 'A', follow: true }])])];
    expect(cascadeFollowers(ps, new Map([['A', end('2026-11-17', '2026-11-18')]]), new Set()).get('X'))
      .toEqual({ startDate: '2026-11-19', endDate: '2026-11-19' });
  });
});

describe('link graph', () => {
  const ps = () => [proj('p', [mk('A', '2026-11-16', '2026-11-17'), mk('B', '2026-11-18', '2026-11-19', [{ taskId: 'A', follow: false }])])];
  it('wouldCreateCycle even through follow:false', () => expect(wouldCreateCycle(ps(), 'A', 'B')).toBe(true));
  it('wouldCreateCycle false for a fresh link', () => expect(wouldCreateCycle(ps(), 'B', 'A')).toBe(false));
  it('canLink reasons', () => {
    expect(canLink(ps(), 'A', 'A')).toEqual({ ok: false, reason: 'self' });
    expect(canLink(ps(), 'B', 'A')).toEqual({ ok: false, reason: 'duplicate' });
    expect(canLink(ps(), 'A', 'B')).toEqual({ ok: false, reason: 'cycle' });
    expect(canLink(ps(), 'A', 'Z')).toEqual({ ok: false, reason: 'missing' });
  });
  it('removeReferences strips links to removed ids', () => {
    const p = ps(); removeReferences(p, new Set(['A']));
    expect(p[0].tasks[1].dependsOn).toBeUndefined();
  });
});
