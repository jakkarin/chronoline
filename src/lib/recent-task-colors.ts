import { isHexTaskColor, isPresetTaskColor } from '@/lib/task-colors';
import type { TaskColor, Timeline } from '@/lib/types';

export const RECENT_TASK_COLORS_STORAGE_KEY = 'chronoline:recent-task-colors';
export const MAX_RECENT_TASK_COLORS = 6;

const listeners = new Set<() => void>();
let cachedRecentTaskColors: TaskColor[] | null = null;
let storageSubscriptionInitialized = false;

function isTaskColor(value: unknown): value is TaskColor {
  return typeof value === 'string' && (isHexTaskColor(value) || isPresetTaskColor(value));
}

export function normalizeRecentTaskColors(colors: Iterable<unknown>): TaskColor[] {
  const normalized: TaskColor[] = [];

  for (const color of colors) {
    if (!isTaskColor(color) || normalized.includes(color)) continue;
    normalized.push(color);

    if (normalized.length === MAX_RECENT_TASK_COLORS) {
      break;
    }
  }

  return normalized;
}

export function extractRecentTaskColorsFromTimeline(timeline: Pick<Timeline, 'projects'>): TaskColor[] {
  return normalizeRecentTaskColors(
    timeline.projects.flatMap((project) =>
      project.tasks.map((task) => task.color).filter((color): color is TaskColor => Boolean(color))
    )
  );
}

export function loadRecentTaskColors(): TaskColor[] {
  if (cachedRecentTaskColors) return cachedRecentTaskColors;
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(RECENT_TASK_COLORS_STORAGE_KEY);
    if (!stored) {
      cachedRecentTaskColors = [];
      return cachedRecentTaskColors;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      cachedRecentTaskColors = [];
      return cachedRecentTaskColors;
    }

    cachedRecentTaskColors = normalizeRecentTaskColors(parsed);
    return cachedRecentTaskColors;
  } catch {
    cachedRecentTaskColors = [];
    return cachedRecentTaskColors;
  }
}

export function getRecentTaskColorsSnapshot(): TaskColor[] {
  return loadRecentTaskColors();
}

function notifyRecentTaskColorsChanged() {
  listeners.forEach((listener) => listener());
}

export function persistRecentTaskColors(colors: Iterable<unknown>): TaskColor[] {
  const nextColors = normalizeRecentTaskColors(colors);
  cachedRecentTaskColors = nextColors;
  if (typeof window !== 'undefined') {
    localStorage.setItem(RECENT_TASK_COLORS_STORAGE_KEY, JSON.stringify(nextColors));
  }

  notifyRecentTaskColorsChanged();
  return nextColors;
}

export function mergeRecentTaskColors(...collections: Array<Iterable<unknown>>): TaskColor[] {
  return persistRecentTaskColors([
    ...loadRecentTaskColors(),
    ...collections.flatMap((collection) => Array.from(collection)),
  ]);
}

export function rememberRecentTaskColor(color: TaskColor | null | undefined): TaskColor[] {
  if (!color) return loadRecentTaskColors();
  return persistRecentTaskColors([color, ...loadRecentTaskColors()]);
}

export function subscribeRecentTaskColors(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if (!storageSubscriptionInitialized) {
    window.addEventListener('storage', (event) => {
      if (event.key !== RECENT_TASK_COLORS_STORAGE_KEY) return;

      cachedRecentTaskColors = null;
      notifyRecentTaskColorsChanged();
    });
    storageSubscriptionInitialized = true;
  }

  listeners.add(onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
  };
}