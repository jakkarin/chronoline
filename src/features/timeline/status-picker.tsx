import { useState } from 'react';
import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Status } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: { value: Status; color: string }[] = [
  { value: 'Not Started', color: '#78716c' },
  { value: 'In Progress', color: '#2563eb' },
  { value: 'Done',        color: '#059669' },
  { value: 'Blocked',     color: '#dc2626' },
  { value: 'On Hold',     color: '#ca8a04' },
];

export const STATUS_COLOR: Record<Status, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.color])
) as Record<Status, string>;

interface Props {
  value: Status;
  onChange: (v: Status) => void;
  compact?: boolean;
}

export function StatusPicker({ value, onChange, compact }: Props) {
  const [open, setOpen] = useState(false);
  const color = STATUS_COLOR[value];

  function handleSelect(nextValue: Status) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap"
        style={{ color, borderColor: color }}
        aria-label={`Status: ${value}`}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        {!compact && value}
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={cn(
              'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
              opt.value === value ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
            )}
            onClick={() => handleSelect(opt.value)}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
            <span className="flex-1">{opt.value}</span>
            {opt.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
