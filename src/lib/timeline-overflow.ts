import { addDays, differenceInCalendarWeeks, format, parseISO, startOfWeek } from 'date-fns';
import { shiftWeekdays, weekdayLength, type TaskDates } from '@/lib/dependencies';
import type { Project } from '@/lib/types';

/** Largest week count the grid supports (matches `generateColumns`). */
export const MAX_WEEKS = 52;

const toStr = (d: Date) => format(d, 'yyyy-MM-dd');
const mondayOf = (date: string) => startOfWeek(parseISO(date), { weekStartsOn: 1 });

/** First (Monday of week 1) and last (Friday of week `weeks`) visible days. */
export function visibleRange(startDate: string, weeks: number): { first: string; last: string } {
  const monday = mondayOf(startDate);
  return { first: toStr(monday), last: toStr(addDays(monday, (weeks - 1) * 7 + 4)) };
}

/**
 * Tasks whose end falls after the last visible day, and the smallest week count
 * that would show all of them (not capped at MAX_WEEKS). Null when nothing overflows.
 */
export function detectOverflow(
  projects: Project[],
  startDate: string,
  weeks: number
): { taskIds: string[]; weeksNeeded: number } | null {
  const { last } = visibleRange(startDate, weeks);
  const late = projects.flatMap((p) => p.tasks).filter((t) => t.endDate > last);
  if (late.length === 0) return null;
  const latest = late.reduce((a, t) => (t.endDate > a ? t.endDate : a), last);
  const weeksNeeded =
    differenceInCalendarWeeks(parseISO(latest), mondayOf(startDate), { weekStartsOn: 1 }) + 1;
  return { taskIds: late.map((t) => t.id), weeksNeeded };
}

/** End at the last visible day, keeping the task's weekday length (start no earlier than the first day). */
export function stopAtEdge(task: TaskDates, range: { first: string; last: string }): TaskDates {
  const start = shiftWeekdays(range.last, -(weekdayLength(task.startDate, task.endDate) - 1));
  return { startDate: start < range.first ? range.first : start, endDate: range.last };
}
