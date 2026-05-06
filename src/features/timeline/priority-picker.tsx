import { useState } from 'react';
import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Priority } from '@/lib/types';
import { cn } from '@/lib/utils';

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'HIGHEST', label: 'HIGHEST', color: '#dc2626' },
  { value: 'HIGH',    label: 'HIGH',    color: '#ea580c' },
  { value: 'MED',     label: 'MED',     color: '#ca8a04' },
  { value: 'LOW',     label: 'LOW',     color: '#0891b2' },
  { value: 'LOWEST',  label: 'LOWEST',  color: '#78716c' },
  { value: null,      label: '—',       color: '#a8a29e' },
];

export const PRIORITY_COLOR: Record<string, string> = {
  HIGHEST: '#dc2626',
  HIGH: '#ea580c',
  MED: '#ca8a04',
  LOW: '#0891b2',
  LOWEST: '#78716c',
  NONE: '#78716c',
};

interface Props {
  value: Priority;
  onChange: (v: Priority) => void;
}

export function PriorityPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const opt = PRIORITY_OPTIONS.find((o) => o.value === value) ?? PRIORITY_OPTIONS[PRIORITY_OPTIONS.length - 1];

  function handleSelect(nextValue: Priority) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white cursor-pointer hover:opacity-80 transition-opacity min-w-11 justify-center"
        style={{ background: opt.color }}
        aria-label={`Priority: ${opt.label}`}
      >
        {opt.label}
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start">
        {PRIORITY_OPTIONS.map((o) => (
          <button
            key={String(o.value)}
            className={cn(
              'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
              o.value === value ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
            )}
            onClick={() => handleSelect(o.value)}
          >
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
              style={{ background: o.color }}
            >
              {o.label}
            </span>
            {o.value === value && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
