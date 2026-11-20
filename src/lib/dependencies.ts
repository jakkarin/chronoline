import { addBusinessDays, differenceInBusinessDays, format, parseISO } from 'date-fns';
import { snapToWeekday } from '@/lib/date-utils';
import type { Project, Task } from '@/lib/types';

export type TaskDates = Pick<Task, 'startDate' | 'endDate'>;

const toStr = (d: Date) => format(d, 'yyyy-MM-dd');

/** Signed number of Mon–Fri steps from `from` to `to` (weekend inputs snap to Monday first). */
export function weekdayDelta(from: string, to: string): number {
  return differenceInBusinessDays(parseISO(snapToWeekday(to)), parseISO(snapToWeekday(from)));
}

/** Move `n` weekdays from `date` (negative = earlier). Weekend input snaps to Monday first. Holidays are not skipped. */
export function shiftWeekdays(date: string, n: number): string {
  const base = parseISO(snapToWeekday(date));
  return n === 0 ? toStr(base) : toStr(addBusinessDays(base, n));
}

/** Inclusive number of Mon–Fri days from `start` to `end`. */
export function weekdayLength(start: string, end: string): number {
  return weekdayDelta(start, end) + 1;
}

/**
 * Copy of `projects` where every `dependsOn` entry points at a task that exists in
 * `projects`, isn't the task itself, and isn't a repeat of an earlier entry.
 * Empty lists become `undefined`.
 */
export function dropDanglingDependencies(projects: Project[]): Project[] {
  const ids = new Set(projects.flatMap((p) => p.tasks.map((t) => t.id)));
  return projects.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) => {
      if (!t.dependsOn) return t;
      const seen = new Set<string>();
      const kept = t.dependsOn.filter((d) => {
        if (d.taskId === t.id || !ids.has(d.taskId) || seen.has(d.taskId)) return false;
        seen.add(d.taskId);
        return true;
      });
      const { dependsOn: _drop, ...rest } = t;
      void _drop;
      return kept.length > 0 ? { ...rest, dependsOn: kept } : rest;
    }),
  }));
}

const allTasks = (projects: Project[]) => projects.flatMap((p) => p.tasks);

/** True if linking `childId` to follow `parentId` would close a loop (any follow value counts). */
export function wouldCreateCycle(projects: Project[], childId: string, parentId: string): boolean {
  if (childId === parentId) return true;
  const parentsOf = new Map(allTasks(projects).map((t) => [t.id, (t.dependsOn ?? []).map((d) => d.taskId)]));
  // Walk up from parentId; reaching childId means childId is already an ancestor of parentId.
  const stack = [parentId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === childId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(parentsOf.get(id) ?? []));
  }
  return false;
}

export type LinkRejection = 'self' | 'duplicate' | 'cycle' | 'missing';

/** User-facing text for a rejected link. */
export const LINK_REJECTION_MESSAGE: Record<LinkRejection, string> = {
  self: "A task can't follow itself",
  duplicate: 'Already linked',
  cycle: 'That link would create a loop',
  missing: 'That task no longer exists',
};

export function canLink(
  projects: Project[],
  childId: string,
  parentId: string
): { ok: true } | { ok: false; reason: LinkRejection } {
  if (childId === parentId) return { ok: false, reason: 'self' };
  const tasks = allTasks(projects);
  const child = tasks.find((t) => t.id === childId);
  if (!child || !tasks.some((t) => t.id === parentId)) return { ok: false, reason: 'missing' };
  if (child.dependsOn?.some((d) => d.taskId === parentId)) return { ok: false, reason: 'duplicate' };
  if (wouldCreateCycle(projects, childId, parentId)) return { ok: false, reason: 'cycle' };
  return { ok: true };
}

/**
 * New dates for every task that follows (follow: true) a task whose end moved.
 * Followers move start and end by the parent's weekday delta and pass their own
 * change on. A task reached twice takes the largest |delta| (ties: the later date).
 * Tasks in `locked` (edited directly) are never moved and stop the cascade; the
 * originating tasks are never moved by it either, so cycles terminate.
 */
export function cascadeFollowers(
  projects: Project[],
  endChanges: Map<string, { oldEnd: string; newEnd: string }>,
  locked: ReadonlySet<string>
): Map<string, TaskDates> {
  const tasks = allTasks(projects);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const followersOf = new Map<string, string[]>();
  for (const t of tasks) {
    for (const d of t.dependsOn ?? []) {
      if (!d.follow) continue;
      followersOf.set(d.taskId, [...(followersOf.get(d.taskId) ?? []), t.id]);
    }
  }

  const sources = new Set(endChanges.keys());
  const best = new Map<string, number>(); // follower id → chosen delta
  const queue: { id: string; delta: number }[] = [];
  for (const [id, { oldEnd, newEnd }] of endChanges) {
    const delta = weekdayDelta(oldEnd, newEnd);
    if (delta !== 0) queue.push({ id, delta });
  }

  while (queue.length) {
    const { id, delta } = queue.shift()!;
    for (const fid of followersOf.get(id) ?? []) {
      if (sources.has(fid) || locked.has(fid)) continue;
      const prev = best.get(fid);
      const better = prev === undefined || Math.abs(delta) > Math.abs(prev) || (Math.abs(delta) === Math.abs(prev) && delta > prev);
      if (!better) continue;
      best.set(fid, delta);
      queue.push({ id: fid, delta });
    }
  }

  const out = new Map<string, TaskDates>();
  for (const [id, delta] of best) {
    const t = byId.get(id)!;
    out.set(id, { startDate: shiftWeekdays(t.startDate, delta), endDate: shiftWeekdays(t.endDate, delta) });
  }
  return out;
}

/** Strip links that point at removed tasks. Mutates (meant for Immer drafts). */
export function removeReferences(projects: Project[], removedIds: ReadonlySet<string>): void {
  for (const t of allTasks(projects)) {
    if (!t.dependsOn) continue;
    const kept = t.dependsOn.filter((d) => !removedIds.has(d.taskId));
    if (kept.length === 0) delete t.dependsOn;
    else if (kept.length !== t.dependsOn.length) t.dependsOn = kept;
  }
}
