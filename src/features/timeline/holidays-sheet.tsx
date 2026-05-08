import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { loadHolidayPresets, THAI_PUBLIC_HOLIDAYS_2026 } from '@/lib/holiday-preset';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTimelineStore } from '@/store/timeline-store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HolidaysSheet({ open, onOpenChange }: Props) {
  const holidays = useTimelineStore((s) => s.timeline?.holidays ?? []);
  const toggleHoliday = useTimelineStore((s) => s.toggleHoliday);
  const setHolidays = useTimelineStore((s) => s.setHolidays);
  const [month, setMonth] = useState<Date>(new Date());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  const presets = loadHolidayPresets();
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? null;

  const selected = holidays.map((h) => parseISO(h));

  function addThaiHolidays() {
    for (const d of THAI_PUBLIC_HOLIDAYS_2026) {
      if (!holidays.includes(d)) toggleHoliday(d);
    }
  }

  function applyPresetOverride() {
    if (!selectedPreset) return;
    setHolidays(selectedPreset.holidays);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-80">
        <SheetHeader>
          <SheetTitle>Holidays</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-4 px-4 overflow-y-auto pb-4">
          <div className="grid gap-2">
            <Select value={selectedPresetId} onValueChange={(value) => setSelectedPresetId(value ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select preset to override">
                  {selectedPreset?.name ?? 'Select preset to override'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={applyPresetOverride} disabled={!selectedPreset}>
              Override with preset
            </Button>

            {presets.length === 0 && (
              <p className="text-xs text-muted-foreground">No holiday presets available on the dashboard yet.</p>
            )}
          </div>

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
