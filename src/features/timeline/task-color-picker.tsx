import { useEffect, useId, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  HEX_TASK_COLOR_PATTERN,
  isHexTaskColor,
  isPresetTaskColor,
  TASK_COLOR_OPTIONS,
  resolveTaskBarColor,
} from '@/lib/task-colors';
import type { Priority, TaskColor } from '@/lib/types';
import { cn } from '@/lib/utils';

const RECENT_TASK_COLORS_STORAGE_KEY = 'chronoline:recent-task-colors';
const MAX_RECENT_TASK_COLORS = 6;

function isTaskColor(value: string): value is TaskColor {
  return isHexTaskColor(value) || isPresetTaskColor(value);
}

function loadRecentTaskColors(): TaskColor[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(RECENT_TASK_COLORS_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is string => typeof value === 'string')
      .filter(isTaskColor)
      .slice(0, MAX_RECENT_TASK_COLORS);
  } catch {
    return [];
  }
}

function persistRecentTaskColors(colors: TaskColor[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RECENT_TASK_COLORS_STORAGE_KEY, JSON.stringify(colors));
}

function normalizeHexInput(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function getRecentColorLabel(color: TaskColor): string {
  const preset = TASK_COLOR_OPTIONS.find((option) => option.value === color);
  return preset ? preset.label : color;
}

interface TaskColorPickerProps {
  value: TaskColor | null | undefined;
  priority: Priority;
  onChange: (value: TaskColor | null) => void;
}

export function TaskColorPicker({ value, priority, onChange }: TaskColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [recentColors, setRecentColors] = useState<TaskColor[]>(loadRecentTaskColors);
  const [hexInput, setHexInput] = useState('');
  const hexInputId = useId();
  const displayColor = resolveTaskBarColor(value, priority);
  const pickerColor = isHexTaskColor(value) ? value : displayColor;
  const latestCustomColorRef = useRef<TaskColor | null>(isHexTaskColor(value) ? value : null);
  const pendingRecentColorRef = useRef<TaskColor | null>(null);
  const normalizedHexInput = normalizeHexInput(hexInput);
  const isHexInputValid = HEX_TASK_COLOR_PATTERN.test(normalizedHexInput);

  useEffect(() => {
    setHexInput(pickerColor);
  }, [pickerColor, open]);

  function rememberColor(nextValue: TaskColor | null) {
    if (!nextValue) return;

    setRecentColors((current) => {
      const nextColors = [nextValue, ...current.filter((color) => color !== nextValue)]
        .slice(0, MAX_RECENT_TASK_COLORS);

      persistRecentTaskColors(nextColors);
      return nextColors;
    });
  }

  function queueRecentColor(nextValue: TaskColor | null) {
    pendingRecentColorRef.current = nextValue;
  }

  function commitPendingRecentColor() {
    rememberColor(pendingRecentColorRef.current);
    pendingRecentColorRef.current = null;
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      pendingRecentColorRef.current = null;
      return;
    }

    commitPendingRecentColor();
  }

  function handleSelect(nextValue: TaskColor | null) {
    queueRecentColor(nextValue);
    onChange(nextValue);
    handleOpenChange(false);
  }

  function handleCustomPickerChange(nextColor: string) {
    const normalized = nextColor.toLowerCase() as TaskColor;
    latestCustomColorRef.current = normalized;
    queueRecentColor(normalized);
    setHexInput(normalized);
    onChange(normalized);
  }

  function commitHexInput(closeAfterCommit = false) {
    if (!isHexInputValid) {
      setHexInput(pickerColor);
      return false;
    }

    const normalized = normalizedHexInput as TaskColor;
    latestCustomColorRef.current = normalized;
    queueRecentColor(normalized);
    onChange(normalized);

    if (closeAfterCommit) {
      handleOpenChange(false);
    }

    return true;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background hover:bg-accent transition-colors"
        aria-label={value ? `Task color: ${value}` : 'Task color: auto'}
      >
        <span
          className="h-3.5 w-3.5 rounded-full border border-black/10"
          style={{ background: displayColor }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-92 p-3" align="start">
        <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3">
          <div className="space-y-3 border-r border-border pr-3">
            <button
              className={cn(
                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                !value ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
              )}
              onClick={() => handleSelect(null)}
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

            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Presets
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TASK_COLOR_OPTIONS.map((option) => {
                  const selected = option.value === value;

                  return (
                    <button
                      key={option.value}
                      className={[
                        'relative flex h-9 items-center justify-center rounded-md border transition-colors',
                        selected ? 'border-foreground bg-accent' : 'border-border hover:bg-accent',
                      ].join(' ')}
                      onClick={() => handleSelect(option.value)}
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
            </div>

            {recentColors.length > 0 && (
              <div className="border-t border-border pt-3">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Recent
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {recentColors.map((recentColor) => {
                    const selected = recentColor === value;

                    return (
                      <button
                        key={recentColor}
                        className={cn(
                          'relative flex h-8 items-center justify-center rounded-md border transition-colors',
                          selected ? 'border-foreground bg-accent' : 'border-border hover:bg-accent'
                        )}
                        onClick={() => handleSelect(recentColor)}
                        aria-label={`Use recent color ${getRecentColorLabel(recentColor)}`}
                        title={getRecentColorLabel(recentColor)}
                      >
                        <span
                          className="h-4 w-4 rounded-full border border-black/10"
                          style={{ background: resolveTaskBarColor(recentColor, priority) }}
                        />
                        {selected && <Check className="absolute right-0.5 top-0.5 h-3 w-3 text-foreground" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Custom</span>
                <span className="font-mono normal-case text-foreground">{pickerColor}</span>
              </div>
              <div>
                <HexColorPicker
                  color={pickerColor}
                  onChange={handleCustomPickerChange}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="space-y-1.5 border-t border-border pt-3">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground" htmlFor={hexInputId}>
                Hex
              </label>
              <Input
                id={hexInputId}
                value={hexInput}
                onChange={(event) => setHexInput(event.target.value)}
                onBlur={() => {
                  commitHexInput(false);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  commitHexInput(true);
                }}
                placeholder="#0f766e"
                className="font-mono lowercase"
                aria-invalid={hexInput.length > 0 && !isHexInputValid}
              />
              <p className="text-[11px] text-muted-foreground">
                Enter a 6-digit hex value. Press Enter to apply.
              </p>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}