import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '@/store/timeline-store';
import type { Timeline } from '@/lib/types';

const task = (id: string, startDate: string, endDate: string) => ({
  id, name: id, status: 'Not Started' as const, priority: 'MED' as const, color: null,
  owner: '', startDate, endDate, deliverable: '', percentComplete: 0,
});

const timeline: Timeline = {
  id: 'tl_test', title: 'T', customer: '', startDate: '2026-11-16', weeks: 4, note: '',
  createdAt: 0, updatedAt: 0, projectCount: 2, taskCount: 3, holidays: [],
  projects: [
    { id: 'p_1', name: 'P1', status: 'Not Started', deliverable: '', expanded: true,
      tasks: [task('t_1', '2026-11-16', '2026-11-17'), task('t_2', '2026-11-16', '2026-11-27')] },
    { id: 'p_2', name: 'P2', status: 'Not Started', deliverable: '', expanded: true,
      tasks: [task('t_3', '2026-11-16', '2026-11-17')] },
  ],
};

const datesOf = (id: string) => {
  const t = useTimelineStore.getState().timeline!.projects.flatMap((p) => p.tasks).find((x) => x.id === id)!;
  return [t.startDate, t.endDate];
};

describe('setTasksStartDate', () => {
  beforeEach(() => {
    useTimelineStore.getState().setTimeline(structuredClone(timeline));
    useTimelineStore.temporal.getState().clear();
  });

  it('applies the bulk rule to selected tasks across projects only', () => {
    useTimelineStore.getState().setTasksStartDate(['t_1', 't_3'], '2026-11-20');
    expect(datesOf('t_1')).toEqual(['2026-11-20', '2026-11-23']);
    expect(datesOf('t_3')).toEqual(['2026-11-20', '2026-11-23']);
    expect(datesOf('t_2')).toEqual(['2026-11-16', '2026-11-27']);
  });

  it('is a single undo step', () => {
    useTimelineStore.getState().setTasksStartDate(['t_1', 't_3'], '2026-11-18');
    useTimelineStore.temporal.getState().undo();
    expect(datesOf('t_1')).toEqual(['2026-11-16', '2026-11-17']);
    expect(datesOf('t_3')).toEqual(['2026-11-16', '2026-11-17']);
  });
});

// ── Dependencies, commitDateChange ──────────────────────────────────────────
// Timeline 27 Apr – 3 Jul 2026 (10 weeks). A 22–24 Jun; B follows A 25–26 Jun; C follows B 29 Jun.
const depTimeline = (): Timeline => ({
  id: 'tl_dep', title: 'D', customer: '', startDate: '2026-04-27', weeks: 10, note: '',
  createdAt: 0, updatedAt: 0, projectCount: 1, taskCount: 3, holidays: [],
  projects: [{ id: 'p_1', name: 'P', status: 'Not Started', deliverable: '', expanded: true, tasks: [
    task('A', '2026-06-22', '2026-06-24'),
    { ...task('B', '2026-06-25', '2026-06-26'), dependsOn: [{ taskId: 'A', follow: true }] },
    { ...task('C', '2026-06-29', '2026-06-29'), dependsOn: [{ taskId: 'B', follow: true }] },
  ] }],
});
const st = () => useTimelineStore.getState();
const tl = () => st().timeline!;

describe('commitDateChange', () => {
  beforeEach(() => {
    st().setTimeline(depTimeline());
    useTimelineStore.temporal.getState().clear();
  });

  it('commitDateChange task end moves followers', () => {
    expect(st().commitDateChange({ kind: 'task', taskId: 'A', patch: { endDate: '2026-06-26' } })).toBeNull();
    expect(datesOf('B')).toEqual(['2026-06-29', '2026-06-30']);
    expect(datesOf('C')).toEqual(['2026-07-01', '2026-07-01']);
  });

  it('commitDateChange returns overflow info without changing state', () => {
    const before = tl();
    const info = st().commitDateChange({ kind: 'task', taskId: 'A', patch: { endDate: '2026-07-06' } });
    expect(info).toMatchObject({ fromWeeks: 10, toWeeks: 11, beyondCap: false });
    expect(info!.taskIds.sort()).toEqual(['A', 'B', 'C']);
    expect(tl()).toBe(before);
  });

  it('commitDateChange extend is one undo step incl. weeks', () => {
    st().commitDateChange({ kind: 'task', taskId: 'A', patch: { endDate: '2026-07-06' } }, 'extend');
    expect(tl().weeks).toBe(11);
    expect(datesOf('B')).toEqual(['2026-07-07', '2026-07-08']);
    useTimelineStore.temporal.getState().undo();
    expect(tl().weeks).toBe(10);
    expect(datesOf('B')).toEqual(['2026-06-25', '2026-06-26']);
  });

  it('commitDateChange stopAtEdge keeps length', () => {
    st().commitDateChange({ kind: 'task', taskId: 'A', patch: { endDate: '2026-07-06' } }, 'stopAtEdge');
    expect(tl().weeks).toBe(10);
    expect(datesOf('A')).toEqual(['2026-06-19', '2026-07-03']);
    expect(datesOf('B')).toEqual(['2026-07-02', '2026-07-03']);
  });

  it('commitDateChange extend caps at 52 and stops the rest at edge', () => {
    const edit = { kind: 'task', taskId: 'A', patch: { endDate: '2027-06-04' } } as const;
    expect(st().commitDateChange(edit)).toMatchObject({ toWeeks: 52, beyondCap: true });
    st().commitDateChange(edit, 'extend');
    expect(tl().weeks).toBe(52);
    expect(datesOf('A')[1]).toBe('2027-04-23');
  });

  it('bulkStart cascades and directly edited tasks are not re-shifted', () => {
    st().commitDateChange({ kind: 'bulkStart', taskIds: ['A', 'B'], date: '2026-06-29' });
    expect(datesOf('A')).toEqual(['2026-06-29', '2026-06-30']);
    expect(datesOf('B')).toEqual(['2026-06-29', '2026-06-30']);
    expect(datesOf('C')).toEqual(['2026-07-01', '2026-07-01']);
  });

  it('updateTask with endDate cascades', () => {
    st().updateTask('p_1', 'A', { endDate: '2026-06-25' });
    expect(datesOf('B')).toEqual(['2026-06-26', '2026-06-29']);
  });
});

describe('dependency actions', () => {
  beforeEach(() => {
    st().setTimeline(depTimeline());
    useTimelineStore.temporal.getState().clear();
  });

  it('addDependency rejects cycle', () =>
    expect(st().addDependency('A', 'C')).toEqual({ ok: false, reason: 'cycle' }));

  it('addDependency defaults follow true and does not change dates', () => {
    const before = JSON.stringify(tl().projects.flatMap((p) => p.tasks.map((t) => [t.startDate, t.endDate])));
    expect(st().addDependency('C', 'A')).toEqual({ ok: true });
    const c = tl().projects[0].tasks.find((t) => t.id === 'C')!;
    expect(c.dependsOn).toContainEqual({ taskId: 'A', follow: true });
    expect(JSON.stringify(tl().projects.flatMap((p) => p.tasks.map((t) => [t.startDate, t.endDate])))).toBe(before);
  });

  it('setDependencyFollow and removeDependency', () => {
    st().setDependencyFollow('B', 'A', false);
    expect(tl().projects[0].tasks[1].dependsOn).toEqual([{ taskId: 'A', follow: false }]);
    st().removeDependency('B', 'A');
    expect(tl().projects[0].tasks[1].dependsOn).toBeUndefined();
  });

  it('deleteTask removes references in the same undo step', () => {
    st().deleteTask('p_1', 'A');
    expect(tl().projects[0].tasks.find((t) => t.id === 'B')!.dependsOn).toBeUndefined();
    useTimelineStore.temporal.getState().undo();
    expect(tl().projects[0].tasks.find((t) => t.id === 'B')!.dependsOn).toEqual([{ taskId: 'A', follow: true }]);
  });
});
