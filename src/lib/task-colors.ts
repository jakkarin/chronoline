import type { PresetTaskColor, Priority, TaskColor } from '@/lib/types';

export const DEFAULT_TASK_BAR_COLOR = '#78716c';
export const HEX_TASK_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const PRIORITY_BAR_COLOR: Record<string, string> = {
  HIGHEST: '#dc2626',
  HIGH: '#ea580c',
  MED: '#ca8a04',
  LOW: '#0891b2',
  LOWEST: '#78716c',
  NONE: DEFAULT_TASK_BAR_COLOR,
};

export const TASK_COLOR_VALUES = ['ROSE', 'AMBER', 'EMERALD', 'SKY', 'VIOLET', 'SLATE'] as const;

export const TASK_COLOR_OPTIONS: { value: PresetTaskColor; label: string; color: string }[] = [
  { value: 'ROSE', label: 'Rose', color: '#e11d48' },
  { value: 'AMBER', label: 'Amber', color: '#d97706' },
  { value: 'EMERALD', label: 'Emerald', color: '#059669' },
  { value: 'SKY', label: 'Sky', color: '#0284c7' },
  { value: 'VIOLET', label: 'Violet', color: '#7c3aed' },
  { value: 'SLATE', label: 'Slate', color: '#475569' },
];

const TASK_COLOR_MAP: Record<PresetTaskColor, string> = Object.fromEntries(
  TASK_COLOR_OPTIONS.map((option) => [option.value, option.color])
) as Record<PresetTaskColor, string>;

const TASK_COLOR_VALUE_SET = new Set<string>(TASK_COLOR_VALUES);

export function isHexTaskColor(taskColor: string | null | undefined): taskColor is `#${string}` {
  return HEX_TASK_COLOR_PATTERN.test(taskColor ?? '');
}

export function isPresetTaskColor(taskColor: string | null | undefined): taskColor is PresetTaskColor {
  return TASK_COLOR_VALUE_SET.has(taskColor ?? '');
}

export function resolveTaskBarColor(taskColor: TaskColor | null | undefined, priority: Priority): string {
  if (taskColor) {
    if (isHexTaskColor(taskColor)) return taskColor;
    if (isPresetTaskColor(taskColor)) return TASK_COLOR_MAP[taskColor] ?? DEFAULT_TASK_BAR_COLOR;
  }

  return PRIORITY_BAR_COLOR[priority ?? 'NONE'] ?? DEFAULT_TASK_BAR_COLOR;
}