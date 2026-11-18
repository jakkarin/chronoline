import { nextWeekday, snapToWeekday } from '@/lib/date-utils';
import type { Project, Task } from '@/lib/types';

type TaskDates = Pick<Task, 'startDate' | 'endDate'>;

/**
 * New dates for a task when the user sets one start date on many tasks.
 * Weekend dates snap to the following Monday. An end date that falls before
 * the new start moves to the next weekday after it; otherwise it is kept.
 */
export function bulkStartDatePatch(task: TaskDates, date: string): TaskDates {
  const startDate = snapToWeekday(date);
  const endDate = task.endDate && task.endDate >= startDate ? task.endDate : nextWeekday(startDate);
  return { startDate, endDate };
}

/**
 * Date whose month the bulk start-date calendar should open on: the earliest
 * start among the selected tasks, or `fallback` (the timeline start) if none has one.
 */
export function bulkPickerMonth(projects: Project[], taskIds: string[], fallback: string): string {
  const ids = new Set(taskIds);
  const starts = projects.flatMap((p) => p.tasks.filter((t) => ids.has(t.id) && t.startDate).map((t) => t.startDate));
  return starts.length > 0 ? starts.reduce((a, b) => (b < a ? b : a)) : fallback;
}
