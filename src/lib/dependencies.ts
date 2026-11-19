import { addBusinessDays, differenceInBusinessDays, format, parseISO } from 'date-fns';
import { snapToWeekday } from '@/lib/date-utils';
import type { Task } from '@/lib/types';

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
