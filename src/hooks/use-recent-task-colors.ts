import { useCallback, useSyncExternalStore } from 'react';
import {
  extractRecentTaskColorsFromTimeline,
  getRecentTaskColorsSnapshot,
  mergeRecentTaskColors,
  rememberRecentTaskColor,
  subscribeRecentTaskColors,
} from '@/lib/recent-task-colors';
import type { TaskColor, Timeline } from '@/lib/types';

type TimelineColorSource = Pick<Timeline, 'projects'>;

export function useRecentTaskColors() {
  const recentColors = useSyncExternalStore(
    subscribeRecentTaskColors,
    getRecentTaskColorsSnapshot,
    getRecentTaskColorsSnapshot
  );

  const rememberColor = useCallback((color: TaskColor | null | undefined) => {
    return rememberRecentTaskColor(color);
  }, []);

  const syncFromTimeline = useCallback((timeline: TimelineColorSource | null | undefined) => {
    if (!timeline) {
      return getRecentTaskColorsSnapshot();
    }

    return mergeRecentTaskColors(extractRecentTaskColorsFromTimeline(timeline));
  }, []);

  const syncFromTimelines = useCallback((timelines: Array<TimelineColorSource | null | undefined>) => {
    return mergeRecentTaskColors(
      ...timelines
        .filter((timeline): timeline is TimelineColorSource => Boolean(timeline))
        .map((timeline) => extractRecentTaskColorsFromTimeline(timeline))
    );
  }, []);

  return {
    recentColors,
    rememberColor,
    syncFromTimeline,
    syncFromTimelines,
  };
}