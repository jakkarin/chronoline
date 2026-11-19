import { describe, it, expect } from 'vitest';
import { insertCandidates, planInsert, type InsertInput } from '@/lib/insert-task';
import type { Project } from '@/lib/types';

const t = (id: string, startDate: string, endDate: string, dependsOn?: { taskId: string; follow: boolean }[]) =>
  ({ id, startDate, endDate, ...(dependsOn ? { dependsOn } : {}) });
const projects = (): Project[] => [
  { id: 'fe', tasks: [
    t('UI', '2026-04-27', '2026-05-08'),
    t('CL', '2026-05-01', '2026-05-15'),
    t('DASH', '2026-05-11', '2026-05-15'),
    t('DETAIL', '2026-05-18', '2026-05-22'),
  ] },
  { id: 'be', tasks: [
    t('CORE', '2026-05-04', '2026-05-22'),
    t('X', '2026-05-18', '2026-05-19', [{ taskId: 'DASH', follow: true }]),
    t('Y', '2026-05-20', '2026-05-20', [{ taskId: 'X', follow: true }]),
  ] },
] as unknown as Project[];
const input: InsertInput = { projectId: 'fe', name: 'Design Review', owner: '', startDate: '2026-05-11', endDate: '2026-05-13', followsTaskId: null };
const dates = (m: Map<string, { startDate: string; endDate: string }>, id: string) => m.get(id) && [m.get(id)!.startDate, m.get(id)!.endDate];

describe('insertCandidates', () => {
  it('lists tasks ending on/after the insert start with mode and pre-tick', () => {
    expect(insertCandidates(projects(), input)).toEqual([
      { taskId: 'CL', projectId: 'fe', mode: 'extend', preTicked: false },
      { taskId: 'DASH', projectId: 'fe', mode: 'move', preTicked: true },
      { taskId: 'DETAIL', projectId: 'fe', mode: 'move', preTicked: true },
      { taskId: 'CORE', projectId: 'be', mode: 'extend', preTicked: false },
      { taskId: 'X', projectId: 'be', mode: 'move', preTicked: false },
      { taskId: 'Y', projectId: 'be', mode: 'move', preTicked: false },
    ]);
  });
});

describe('planInsert', () => {
  it('planInsert move shifts ticked tasks by the new task length', () => {
    const r = planInsert(projects(), input, new Set(['DASH', 'DETAIL']), new Set(['X']));
    expect(dates(r.patches, 'DASH')).toEqual(['2026-05-14', '2026-05-20']);
    expect(dates(r.patches, 'DETAIL')).toEqual(['2026-05-21', '2026-05-27']);
  });

  it('planInsert extend lengthens a running task', () => {
    const r = planInsert(projects(), input, new Set(['CL']), new Set());
    expect(dates(r.patches, 'CL')).toEqual(['2026-05-01', '2026-05-20']);
  });

  it('linked follower is shifted and listed', () => {
    const r = planInsert(projects(), input, new Set(['DASH']), new Set());
    expect(dates(r.patches, 'X')).toEqual(['2026-05-21', '2026-05-22']);
    expect(dates(r.patches, 'Y')).toEqual(['2026-05-25', '2026-05-25']);
    expect(r.followers).toEqual([{ taskId: 'X', parentId: 'DASH' }, { taskId: 'Y', parentId: 'X' }]);
  });

  it('unticked follower stays and stops the cascade', () => {
    const r = planInsert(projects(), input, new Set(['DASH']), new Set(['X']));
    expect(r.patches.has('X')).toBe(false);
    expect(r.patches.has('Y')).toBe(false);
    expect(r.followers).toEqual([]);
  });
});
