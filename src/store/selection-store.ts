import { create } from 'zustand';
import type { Timeline } from '@/lib/types';

/**
 * Which tasks are ticked in the editor table. Transient UI state: kept out of
 * the zundo-tracked timeline store so selecting never creates undo steps.
 * Every action replaces the Set so selectors see a new reference.
 */
interface TaskSelectionStore {
  selectedIds: ReadonlySet<string>;
  toggle: (id: string) => void;
  setMany: (ids: string[], selected: boolean) => void;
  clear: () => void;
}

export const useTaskSelectionStore = create<TaskSelectionStore>()((set) => ({
  selectedIds: new Set<string>(),

  toggle: (id) =>
    set(({ selectedIds }) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  setMany: (ids, selected) =>
    set(({ selectedIds }) => {
      const next = new Set(selectedIds);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return { selectedIds: next };
    }),

  clear: () => set({ selectedIds: new Set<string>() }),
}));

/** Selected ids that still exist in the timeline, in table order. */
export function selectExistingIds(
  selected: ReadonlySet<string>,
  timeline: Pick<Timeline, 'projects'> | null
): string[] {
  if (!timeline || selected.size === 0) return [];
  return timeline.projects.flatMap((p) => p.tasks.filter((t) => selected.has(t.id)).map((t) => t.id));
}
