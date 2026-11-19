import { snapToWeekday } from '@/lib/date-utils';
import { cascadeFollowers, shiftWeekdays, weekdayLength, type TaskDates } from '@/lib/dependencies';
import { newId } from '@/lib/id';
import type { Project, Task, Timeline } from '@/lib/types';

/** What the Insert task dialog collects. */
export interface InsertInput {
  projectId: string;
  name: string;
  owner: string;
  startDate: string;
  endDate: string;
  followsTaskId: string | null;
}

export interface InsertCandidate {
  taskId: string;
  projectId: string;
  /** `extend`: already running at the insert start, so its end moves. `move`: the whole task moves. */
  mode: 'move' | 'extend';
  preTicked: boolean;
}

/** Tasks that could be pushed to make room, in table order. */
export function insertCandidates(projects: Project[], input: InsertInput): InsertCandidate[] {
  const start = snapToWeekday(input.startDate);
  return projects.flatMap((p) =>
    p.tasks
      .filter((t) => t.endDate >= start)
      .map((t) => {
        const mode = t.startDate < start ? 'extend' : 'move';
        return { taskId: t.id, projectId: p.id, mode, preTicked: p.id === input.projectId && mode === 'move' } as const;
      })
  );
}

/**
 * New dates for an insert: ticked tasks move (or extend) by the new task's length,
 * then follow links cascade from them. Ticked and explicitly unticked tasks are never
 * moved by the cascade. `followers` lists what the cascade moved, for the 🔗 rows.
 */
export function planInsert(
  projects: Project[],
  input: InsertInput,
  ticked: ReadonlySet<string>,
  unticked: ReadonlySet<string>
): { patches: Map<string, TaskDates>; followers: { taskId: string; parentId: string }[] } {
  const start = snapToWeekday(input.startDate);
  const n = weekdayLength(start, snapToWeekday(input.endDate));
  const all = projects.flatMap((p) => p.tasks);
  const patches = new Map<string, TaskDates>();
  const endChanges = new Map<string, { oldEnd: string; newEnd: string }>();

  for (const t of all) {
    if (!ticked.has(t.id)) continue;
    const dates =
      t.startDate < start
        ? { startDate: t.startDate, endDate: shiftWeekdays(t.endDate, n) }
        : { startDate: shiftWeekdays(t.startDate, n), endDate: shiftWeekdays(t.endDate, n) };
    patches.set(t.id, dates);
    endChanges.set(t.id, { oldEnd: t.endDate, newEnd: dates.endDate });
  }

  const cascaded = cascadeFollowers(projects, endChanges, new Set([...ticked, ...unticked]));
  const followers: { taskId: string; parentId: string }[] = [];
  for (const t of all) {
    const dates = cascaded.get(t.id);
    if (!dates) continue;
    patches.set(t.id, dates);
    const parent = t.dependsOn?.find((d) => d.follow && (ticked.has(d.taskId) || cascaded.has(d.taskId)));
    if (parent) followers.push({ taskId: t.id, parentId: parent.taskId });
  }
  return { patches, followers };
}

/** Apply an insert (new task + chosen shifts + cascade) to an Immer draft. */
export function applyInsertToDraft(
  draft: Timeline,
  input: InsertInput,
  ticked: ReadonlySet<string>,
  unticked: ReadonlySet<string>
): void {
  const project = draft.projects.find((p) => p.id === input.projectId);
  if (!project) return;
  const { patches } = planInsert(draft.projects, input, ticked, unticked);
  for (const t of draft.projects.flatMap((p) => p.tasks)) {
    const dates = patches.get(t.id);
    if (dates) Object.assign(t, dates);
  }

  const task: Task = {
    id: newId('t'),
    name: input.name,
    status: 'Not Started',
    priority: 'MED',
    color: null,
    owner: input.owner,
    startDate: snapToWeekday(input.startDate),
    endDate: snapToWeekday(input.endDate),
    deliverable: '',
    percentComplete: 0,
    ...(input.followsTaskId ? { dependsOn: [{ taskId: input.followsTaskId, follow: true }] } : {}),
  };
  const at = project.tasks.findIndex((t) => t.startDate > task.startDate);
  project.tasks.splice(at === -1 ? project.tasks.length : at, 0, task);
  project.expanded = true;
}
