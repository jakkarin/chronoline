import { HexColorPicker } from 'react-colorful';
import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isHexTaskColor, TASK_COLOR_OPTIONS, resolveTaskBarColor } from '@/lib/task-colors';
import type { Priority, TaskColor } from '@/lib/types';

interface TaskColorPickerProps {
  value: TaskColor | null | undefined;
  priority: Priority;
  onChange: (value: TaskColor | null) => void;
}

export function TaskColorPicker({ value, priority, onChange }: TaskColorPickerProps) {
  const displayColor = resolveTaskBarColor(value, priority);
  const pickerColor = isHexTaskColor(value) ? value : displayColor;

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background hover:bg-accent transition-colors"
        aria-label={value ? `Task color: ${value}` : 'Task color: auto'}
      >
        <span
          className="h-3.5 w-3.5 rounded-full border border-black/10"
          style={{ background: displayColor }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2" align="start">
        <button
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          onClick={() => onChange(null)}
        >
          <span className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 rounded-full border border-black/10"
              style={{ background: resolveTaskBarColor(undefined, priority) }}
            />
            Auto
          </span>
          {!value && <Check className="h-3.5 w-3.5" />}
        </button>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {TASK_COLOR_OPTIONS.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={option.value}
                className={[
                  'relative flex h-9 items-center justify-center rounded-md border transition-colors',
                  selected ? 'border-foreground bg-accent' : 'border-border hover:bg-accent',
                ].join(' ')}
                onClick={() => onChange(option.value)}
                aria-label={`Set task color to ${option.label}`}
                title={option.label}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ background: option.color }}
                />
                {selected && <Check className="absolute right-1 top-1 h-3 w-3 text-foreground" />}
              </button>
            );
          })}
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Custom</span>
            <span className="font-mono normal-case text-foreground">{pickerColor}</span>
          </div>
          <HexColorPicker
            color={pickerColor}
            onChange={(nextColor) => onChange(nextColor.toLowerCase() as TaskColor)}
            style={{ width: '100%' }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}