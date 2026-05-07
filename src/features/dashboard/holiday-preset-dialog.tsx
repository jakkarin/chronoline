import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createHolidayPreset, THAI_PUBLIC_HOLIDAYS_2026, type HolidayPreset, normalizeHolidayPresetDates } from '@/lib/holiday-preset';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: HolidayPreset[];
  selectedPresetId: string | null;
  onSelectedPresetIdChange: (presetId: string | null) => void;
  onPresetsChange: (presets: HolidayPreset[]) => void;
  onSave: (presets: HolidayPreset[]) => void;
}

export function HolidayPresetDialog({
  open,
  onOpenChange,
  presets,
  selectedPresetId,
  onSelectedPresetIdChange,
  onPresetsChange,
  onSave,
}: Props) {
  const [month, setMonth] = useState<Date>(new Date());

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? null;

  function updatePreset(presetId: string, updater: (preset: HolidayPreset) => HolidayPreset) {
    onPresetsChange(
      presets.map((preset) => (preset.id === presetId ? updater(preset) : preset))
    );
  }

  function handleCreatePreset() {
    const preset = createHolidayPreset({ name: `Preset ${presets.length + 1}` });
    onPresetsChange([...presets, preset]);
    onSelectedPresetIdChange(preset.id);
  }

  function handleDeletePreset(presetId: string) {
    const index = presets.findIndex((preset) => preset.id === presetId);
    const nextPresets = presets.filter((preset) => preset.id !== presetId);

    onPresetsChange(nextPresets);

    if (selectedPresetId !== presetId) return;

    const fallback = nextPresets[index] ?? nextPresets[index - 1] ?? null;
    onSelectedPresetIdChange(fallback?.id ?? null);
  }

  const selected = (selectedPreset?.holidays ?? []).map((holiday) => parseISO(holiday));

  function toggleHoliday(date: string) {
    if (!selectedPreset) return;

    if (selectedPreset.holidays.includes(date)) {
      updatePreset(selectedPreset.id, (preset) => ({
        ...preset,
        holidays: preset.holidays.filter((currentDate) => currentDate !== date),
      }));
      return;
    }

    updatePreset(selectedPreset.id, (preset) => ({
      ...preset,
      holidays: normalizeHolidayPresetDates([...preset.holidays, date]),
    }));
  }

  function addThaiHolidays() {
    if (!selectedPreset) return;

    updatePreset(selectedPreset.id, (preset) => ({
      ...preset,
      holidays: normalizeHolidayPresetDates([...preset.holidays, ...THAI_PUBLIC_HOLIDAYS_2026]),
    }));
  }

  function handleSave() {
    onSave(presets);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Holiday Presets</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <Button variant="outline" size="sm" onClick={handleCreatePreset} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New preset
            </Button>

            <div className="max-h-[26rem] overflow-y-auto rounded-md border bg-background">
              <div className="flex flex-col p-1">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectedPresetIdChange(preset.id)}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted',
                      preset.id === selectedPresetId && 'bg-muted'
                    )}
                  >
                    <span className="text-sm font-medium">{preset.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {preset.holidays.length} holiday{preset.holidays.length === 1 ? '' : 's'}
                    </span>
                  </button>
                ))}
                {presets.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground">No presets yet</p>
                )}
              </div>
            </div>
          </div>

          {selectedPreset ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="holiday-preset-name">Preset name</Label>
                  <Input
                    id="holiday-preset-name"
                    value={selectedPreset.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      updatePreset(selectedPreset.id, (preset) => ({
                        ...preset,
                        name,
                      }));
                    }}
                    placeholder="Thailand 2026"
                  />
                </div>

                <Calendar
                  mode="multiple"
                  selected={selected}
                  month={month}
                  onMonthChange={setMonth}
                  onDayClick={(day) => toggleHoliday(format(day, 'yyyy-MM-dd'))}
                  className="rounded border"
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={addThaiHolidays}>
                    Add Thai public holidays 2026
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updatePreset(selectedPreset.id, (preset) => ({ ...preset, holidays: [] }))}
                    disabled={selectedPreset.holidays.length === 0}
                  >
                    Clear all dates
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePreset(selectedPreset.id)}
                    disabled={presets.length === 0}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete preset
                  </Button>
                </div>

                <div className="max-h-72 overflow-y-auto rounded border">
                  <div className="flex flex-col gap-1 p-2">
                    {selectedPreset.holidays.map((holiday) => (
                      <div key={holiday} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted">
                        <span className="font-mono text-xs">{holiday}</span>
                        <button
                          aria-label={`Remove ${holiday}`}
                          onClick={() => toggleHoliday(holiday)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {selectedPreset.holidays.length === 0 && (
                      <p className="px-2 py-1 text-xs text-muted-foreground">No holidays configured in this preset</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Create a preset to start building reusable holiday sets.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save preset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}