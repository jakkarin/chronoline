import { create } from 'zustand';
import { temporal } from 'zundo';
import { produce } from 'immer';
import type { Timeline, TimelineMeta, Project, Task } from '@/lib/types';
import { newId } from '@/lib/id';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface TimelineStore {
  timeline: Timeline | null;
  saveStatus: SaveStatus;
  setTimeline: (tl: Timeline | null) => void;
  setSaveStatus: (s: SaveStatus) => void;
  setMeta: (patch: Partial<TimelineMeta>) => void;
  addProject: () => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addTask: (projectId: string) => void;
  updateTask: (projectId: string, taskId: string, patch: Partial<Task>) => void;
  deleteTask: (projectId: string, taskId: string) => void;
  moveProject: (fromIdx: number, toIdx: number) => void;
  moveTask: (projectId: string, fromIdx: number, toIdx: number) => void;
  toggleHoliday: (date: string) => void;
}

export const useTimelineStore = create<TimelineStore>()(
  temporal(
    (set) => ({
      timeline: null,
      saveStatus: 'idle',

      setTimeline: (tl) => set({ timeline: tl }),
      setSaveStatus: (s) => set({ saveStatus: s }),

      setMeta: (patch) =>
        set(
          produce((state: TimelineStore) => {
            if (!state.timeline) return;
            Object.assign(state.timeline, patch);
          })
        ),

      addProject: () =>
        set(
          produce((state: TimelineStore) => {
            if (!state.timeline) return;
            state.timeline.projects.push({
              id: newId('p'),
              name: 'New Project',
              status: 'Not Started',
              deliverable: '',
              expanded: true,
              tasks: [],
            });
          })
        ),

      updateProject: (id, patch) =>
        set(
          produce((state: TimelineStore) => {
            const p = state.timeline?.projects.find((x) => x.id === id);
            if (p) Object.assign(p, patch);
          })
        ),

      deleteProject: (id) =>
        set(
          produce((state: TimelineStore) => {
            if (!state.timeline) return;
            state.timeline.projects = state.timeline.projects.filter((p) => p.id !== id);
          })
        ),

      addTask: (projectId) =>
        set(
          produce((state: TimelineStore) => {
            const p = state.timeline?.projects.find((x) => x.id === projectId);
            if (!p) return;
            const lastTask = p.tasks[p.tasks.length - 1];
            const startDate = lastTask?.endDate ?? state.timeline?.startDate ?? '';
            p.tasks.push({
              id: newId('t'),
              name: 'New Task',
              status: 'Not Started',
              priority: 'MED',
              owner: '',
              startDate,
              endDate: startDate,
              deliverable: '',
              percentComplete: 0,
            });
            p.expanded = true;
          })
        ),

      updateTask: (projectId, taskId, patch) =>
        set(
          produce((state: TimelineStore) => {
            const p = state.timeline?.projects.find((x) => x.id === projectId);
            const t = p?.tasks.find((x) => x.id === taskId);
            if (t) Object.assign(t, patch);
          })
        ),

      deleteTask: (projectId, taskId) =>
        set(
          produce((state: TimelineStore) => {
            const p = state.timeline?.projects.find((x) => x.id === projectId);
            if (p) p.tasks = p.tasks.filter((t) => t.id !== taskId);
          })
        ),

      moveProject: (fromIdx, toIdx) =>
        set(
          produce((state: TimelineStore) => {
            if (!state.timeline) return;
            const projects = state.timeline.projects;
            const [item] = projects.splice(fromIdx, 1);
            projects.splice(toIdx, 0, item);
          })
        ),

      moveTask: (projectId, fromIdx, toIdx) =>
        set(
          produce((state: TimelineStore) => {
            const p = state.timeline?.projects.find((x) => x.id === projectId);
            if (!p) return;
            const [item] = p.tasks.splice(fromIdx, 1);
            p.tasks.splice(toIdx, 0, item);
          })
        ),

      toggleHoliday: (date) =>
        set(
          produce((state: TimelineStore) => {
            if (!state.timeline) return;
            const holidays = state.timeline.holidays;
            const idx = holidays.indexOf(date);
            if (idx === -1) {
              holidays.push(date);
            } else {
              holidays.splice(idx, 1);
            }
          })
        ),
    }),
    {
      limit: 50,
      partialize: (s) => ({ timeline: s.timeline }),
      equality: (a, b) => JSON.stringify(a.timeline) === JSON.stringify(b.timeline),
      handleSet: (handleSet) => (state) => {
        const s = typeof state === 'function' ? state(useTimelineStore.getState()) : state;
        if (s.timeline === null) return;
        handleSet(state);
      },
    }
  )
);
