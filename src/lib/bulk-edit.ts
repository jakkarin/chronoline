import { nextWeekday, snapToWeekday } from '@/lib/date-utils';
import type { Task } from '@/lib/types';

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
