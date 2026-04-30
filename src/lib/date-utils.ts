import {
  startOfWeek,
  addDays,
  format,
  parseISO,
  isWeekend,
  isToday as dfnsIsToday,
  isSameDay,
} from 'date-fns';

export interface DateColumn {
  date: Date;
  dateStr: string;
  weekIndex: number;
  dayIndex: number;
}

export function generateColumns(startDate: string, weeks: number): DateColumn[] {
  const anchor = startOfWeek(parseISO(startDate), { weekStartsOn: 1 });
  const cols: DateColumn[] = [];
  const totalWeeks = Math.max(1, Math.min(52, weeks));

  for (let w = 0; w < totalWeeks; w++) {
    for (let d = 0; d < 5; d++) {
      const date = addDays(anchor, w * 7 + d);
      cols.push({
        date,
        dateStr: format(date, 'yyyy-MM-dd'),
        weekIndex: w,
        dayIndex: d,
      });
    }
  }
  return cols;
}

export function workingDaysBetween(start: string, end: string, holidays: string[] = []): number {
  if (!start || !end) return 0;
  const a = parseISO(start);
  const b = parseISO(end);
  if (b < a) return 0;

  let count = 0;
  let cur = a;
  while (cur <= b) {
    if (!isWeekend(cur) && !holidays.includes(format(cur, 'yyyy-MM-dd'))) {
      count++;
    }
    cur = addDays(cur, 1);
  }
  return count;
}

export function isToday(dateStr: string): boolean {
  return dfnsIsToday(parseISO(dateStr));
}

export function isHoliday(dateStr: string, holidays: string[]): boolean {
  return holidays.includes(dateStr);
}

export function colIndexFromDate(dateStr: string, cols: DateColumn[]): number | null {
  const idx = cols.findIndex((c) => c.dateStr === dateStr);
  return idx === -1 ? null : idx;
}

export function isSameDayStr(a: string, b: Date): boolean {
  return isSameDay(parseISO(a), b);
}

export const DAY_LABELS = ['M', 'T', 'W', 'T', 'F'];
