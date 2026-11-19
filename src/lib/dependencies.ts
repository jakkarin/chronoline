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
