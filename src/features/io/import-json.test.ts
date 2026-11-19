import { describe, it, expect } from 'vitest';
import { parseImportJSON } from '@/features/io/import-json';

const task = (id: string, dependsOn?: { taskId: string; follow: boolean }[]) => ({
  id, name: id, status: 'Not Started', priority: 'MED', color: null, owner: '',
  startDate: '2026-11-16', endDate: '2026-11-17', deliverable: '', percentComplete: 0,
  ...(dependsOn ? { dependsOn } : {}),
});
const project = (tasks: unknown[]) => ({ id: 'p_1', name: 'P', status: 'Not Started', deliverable: '', expanded: true, tasks });
const envelope = (projects: unknown[], versions?: unknown[]) => JSON.stringify({
  $schema: 'project-timeline/v1', exportedAt: '2026-11-19T00:00:00Z',
  timeline: { id: 'tl_1', title: 'T', customer: '', startDate: '2026-11-16', weeks: 4, note: '',
    createdAt: 0, updatedAt: 0, projectCount: 1, taskCount: 2, projects, holidays: [] },
  ...(versions ? { versions } : {}),
});

describe('parseImportJSON links', () => {
  it('keeps dependsOn on import', () => {
    const r = parseImportJSON(envelope([project([task('t_1'), task('t_2', [{ taskId: 't_1', follow: false }])])]));
    expect(r.timeline.projects[0].tasks[1].dependsOn).toEqual([{ taskId: 't_1', follow: false }]);
  });

  it('drops dangling links in timeline and each version', () => {
    const version = { id: 'v_1', timelineId: 'tl_1', name: 'v', createdAt: 0, schemaVersion: 1,
      stats: { projectCount: 1, taskCount: 1 },
      snapshot: { projects: [project([task('t_2', [{ taskId: 't_1', follow: true }])])], holidays: [] } };
    const r = parseImportJSON(envelope(
      [project([task('t_1'), task('t_2', [{ taskId: 't_1', follow: true }, { taskId: 't_gone', follow: true }])])],
      [version],
    ));
    expect(r.timeline.projects[0].tasks[1].dependsOn).toEqual([{ taskId: 't_1', follow: true }]);
    expect(r.versions[0].snapshot.projects[0].tasks[0].dependsOn).toBeUndefined();
  });

  it('files without dependsOn still import', () => {
    const r = parseImportJSON(envelope([project([task('t_1')])]));
    expect(r.timeline.projects[0].tasks[0].dependsOn).toBeUndefined();
  });
});

describe('parseImportJSON tasks without color', () => {
  it('imports tasks that have no color key (e.g. sample data exported as-is)', () => {
    const t = task('t_1') as Record<string, unknown>;
    delete t.color;
    expect(() => parseImportJSON(envelope([project([t])]))).not.toThrow();
  });
});
