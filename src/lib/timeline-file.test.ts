import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pickTimelineFileForDirectEdit } from '@/lib/timeline-file';
import { getTimelineAdapter, saveTimelineForSession } from '@/lib/timeline-adapters';
import type { TimelineExport } from '@/lib/types';

// Direct-edit (file) mode end to end, with an in-memory stand-in for the browser's
// file picker and file handle: open → edit → save → reopen.

const task = (id: string, startDate: string, endDate: string, dependsOn?: { taskId: string; follow: boolean }[]) => ({
  id, name: id, status: 'Not Started', priority: 'MED', owner: '', startDate, endDate, deliverable: '', percentComplete: 0,
  ...(dependsOn ? { dependsOn } : {}),
});

const envelope = (): TimelineExport => ({
  $schema: 'project-timeline/v1',
  exportedAt: '2026-11-19T00:00:00.000Z',
  timeline: {
    id: 'tl_file', title: 'File plan', customer: '', startDate: '2026-11-16', weeks: 4, note: '',
    createdAt: 1, updatedAt: 1, projectCount: 1, taskCount: 2, holidays: [],
    projects: [{ id: 'p_1', name: 'P', status: 'Not Started', deliverable: '', expanded: true, tasks: [
      task('t_a', '2026-11-16', '2026-11-17'),
      task('t_b', '2026-11-18', '2026-11-19', [{ taskId: 't_a', follow: false }]),
    ] }],
  } as TimelineExport['timeline'],
  versions: [],
});

/** A file the fake picker returns; `writes` records every completed save. */
function fakeFile(initial: string) {
  const state = { content: initial, writes: 0 };
  const handle = {
    kind: 'file',
    name: 'plan.json',
    getFile: async () => new File([state.content], 'plan.json', { type: 'application/json' }),
    createWritable: async () => {
      let buf = '';
      return {
        write: async (chunk: string) => { buf += chunk; },
        close: async () => { state.content = buf; state.writes += 1; },
      };
    },
  };
  return { state, handle: handle as unknown as FileSystemFileHandle };
}

const g = globalThis as unknown as { window?: unknown };
let file: ReturnType<typeof fakeFile>;

beforeEach(() => {
  file = fakeFile(JSON.stringify(envelope()));
  g.window = { showOpenFilePicker: async () => [file.handle] };
});
afterEach(() => {
  delete g.window;
});

describe('direct-edit file mode', () => {
  it('opens a file with its links and keeps the handle for saving', async () => {
    const opened = await pickTimelineFileForDirectEdit();
    expect(opened.fileName).toBe('plan.json');
    expect(opened.fileHandle).toBe(file.handle);
    expect(opened.timeline.projects[0].tasks[1].dependsOn).toEqual([{ taskId: 't_a', follow: false }]);
  });

  it('never autosaves', async () => {
    const opened = await pickTimelineFileForDirectEdit();
    const session = { mode: 'file' as const, fileHandle: opened.fileHandle, fileName: opened.fileName, versions: [] };
    expect(getTimelineAdapter(session).canAutosave).toBe(false);
    await getTimelineAdapter(session).persistTimeline({ timeline: opened.timeline, session });
    expect(file.state.writes).toBe(0);
  });

  it('save writes links, weeks, correct counts and a newer updatedAt; reopening restores them', async () => {
    const opened = await pickTimelineFileForDirectEdit();
    const session = { mode: 'file' as const, fileHandle: opened.fileHandle, fileName: opened.fileName, versions: [] };
    const edited = structuredClone(opened.timeline);
    edited.weeks = 6;
    edited.projects[0].tasks.push({ ...task('t_c', '2026-11-20', '2026-11-20'), dependsOn: [{ taskId: 't_b', follow: true }] } as never);

    await saveTimelineForSession(edited, session);
    expect(file.state.writes).toBe(1);

    const saved = JSON.parse(file.state.content) as TimelineExport;
    expect(saved.timeline.weeks).toBe(6);
    expect(saved.timeline.taskCount).toBe(3);
    expect(saved.timeline.projectCount).toBe(1);
    expect(saved.timeline.updatedAt).toBeGreaterThan(1);

    const reopened = await pickTimelineFileForDirectEdit();
    const links = reopened.timeline.projects[0].tasks.map((t) => [t.id, t.dependsOn ?? []]);
    expect(links).toEqual([
      ['t_a', []],
      ['t_b', [{ taskId: 't_a', follow: false }]],
      ['t_c', [{ taskId: 't_b', follow: true }]],
    ]);
  });

  it('versions saved in the file keep their links', async () => {
    const opened = await pickTimelineFileForDirectEdit();
    let session: Parameters<typeof saveTimelineForSession>[1] = {
      mode: 'file', fileHandle: opened.fileHandle, fileName: opened.fileName, versions: [],
    };
    session = await getTimelineAdapter(session).saveVersion({ timeline: opened.timeline, session }, 'with links');
    await saveTimelineForSession(opened.timeline, session);

    const reopened = await pickTimelineFileForDirectEdit();
    const v = reopened.versions.find((x) => x.name === 'with links')!;
    expect(v.snapshot.projects[0].tasks[1].dependsOn).toEqual([{ taskId: 't_a', follow: false }]);
  });

  it('reports a browser without the file picker', async () => {
    g.window = {};
    await expect(pickTimelineFileForDirectEdit()).rejects.toThrow('does not support direct file editing');
  });
});
