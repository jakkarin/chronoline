import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { timelineRepo } from '@/lib/db/timelines';
import type { HolidayPreset } from '@/lib/holiday-preset';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  holidayPresets?: HolidayPreset[];
  selectedHolidayPresetId: string;
  onSelectedHolidayPresetIdChange: (presetId: string) => void;
}

export function NewTimelineDialog({
  open,
  onOpenChange,
  onCreated,
  holidayPresets = [],
  selectedHolidayPresetId,
  onSelectedHolidayPresetIdChange,
}: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [customer, setCustomer] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [weeks, setWeeks] = useState(9);
  const [loading, setLoading] = useState(false);
  const selectedPreset = holidayPresets.find((preset) => preset.id === selectedHolidayPresetId) ?? null;

  async function handleCreate() {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const id = await timelineRepo.create({
        title: title.trim(),
        customer,
        startDate,
        weeks,
        projects: [],
        holidays: [...(selectedPreset?.holidays ?? [])],
      });
      onOpenChange(false);
      onCreated?.();
      navigate(`/timeline/${id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Timeline</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="tl-title">Title</Label>
            <Input id="tl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project name" autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tl-customer">Customer</Label>
            <Input id="tl-customer" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Client name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tl-start">Start Date</Label>
              <Input id="tl-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tl-weeks">Span (weeks)</Label>
              <Input id="tl-weeks" type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tl-holiday-preset">Holiday Preset</Label>
            <Select value={selectedHolidayPresetId} onValueChange={onSelectedHolidayPresetIdChange}>
              <SelectTrigger id="tl-holiday-preset">
                <SelectValue placeholder="No preset">
                  {selectedPreset?.name ?? 'No preset'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No preset</SelectItem>
                {holidayPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {selectedPreset
              ? `${selectedPreset.holidays.length} holiday${selectedPreset.holidays.length === 1 ? '' : 's'} from ${selectedPreset.name} will be copied into this timeline.`
              : holidayPresets.length > 0
                ? 'This timeline will start without holidays unless you select a preset.'
                : 'No dashboard holiday preset is configured. This timeline will start without holidays.'}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!title.trim() || loading}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
