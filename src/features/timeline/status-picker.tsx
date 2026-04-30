import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Status } from '@/lib/types';

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
  const color = STATUS_COLOR[value];

  return (
    <Popover>
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
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors text-left"
            onClick={() => onChange(opt.value)}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
            {opt.value}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
