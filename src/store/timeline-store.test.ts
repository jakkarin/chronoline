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
