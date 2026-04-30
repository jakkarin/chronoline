import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useTimelineStore } from '@/store/timeline-store';

const THAI_HOLIDAYS_2026 = [
  '2026-01-01', '2026-02-12', '2026-03-16', '2026-04-06',
  '2026-04-13', '2026-04-14', '2026-04-15', '2026-05-01',
  '2026-05-04', '2026-05-11', '2026-06-03', '2026-07-28',
  '2026-08-12', '2026-10-13', '2026-10-23', '2026-12-05',
  '2026-12-10', '2026-12-31',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HolidaysSheet({ open, onOpenChange }: Props) {
  const holidays = useTimelineStore((s) => s.timeline?.holidays ?? []);
  const toggleHoliday = useTimelineStore((s) => s.toggleHoliday);
  const [month, setMonth] = useState<Date>(new Date());

  const selected = holidays.map((h) => parseISO(h));

  function addThaiHolidays() {
    for (const d of THAI_HOLIDAYS_2026) {
      if (!holidays.includes(d)) toggleHoliday(d);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-80">
        <SheetHeader>
          <SheetTitle>Holidays</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-4 px-4 overflow-y-auto pb-4">
          <Calendar
            mode="multiple"
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            onDayClick={(day) => {
              toggleHoliday(format(day, 'yyyy-MM-dd'));
            }}
            className="rounded border"
          />

          <Button variant="outline" size="sm" onClick={addThaiHolidays}>
            Add Thai public holidays 2026
          </Button>

          <div className="flex flex-col gap-1">
            {[...holidays].sort().map((h) => (
              <div key={h} className="flex items-center justify-between text-sm px-2 py-1 rounded hover:bg-muted">
                <span className="font-mono text-xs">{h}</span>
                <button
                  aria-label={`Remove ${h}`}
                  onClick={() => toggleHoliday(h)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {holidays.length === 0 && (
              <p className="text-xs text-muted-foreground px-2">No holidays set</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
