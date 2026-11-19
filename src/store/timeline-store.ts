import { create } from 'zustand';
import { temporal } from 'zundo';
import { produce } from 'immer';
import { getTimelineAdapter } from '@/lib/timeline-adapters';
import type { Timeline, TimelineMeta, Project, Task } from '@/lib/types';
import { newId } from '@/lib/id';
import { canLink, removeReferences, type LinkRejection } from '@/lib/dependencies';
import { applyDateEdit, overflowInfo, resolveOverflow, type DateEdit, type OverflowChoice, type OverflowInfo } from '@/store/date-change';
import type { EditorSession } from '@/lib/timeline-file';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface TimelineStore {
  timeline: Timeline | null;
  editorSession: EditorSession | null;
  saveStatus: SaveStatus;
  setTimeline: (tl: Timeline | null) => void;
  setEditorSession: (session: EditorSession | null) => void;
  setSaveStatus: (s: SaveStatus) => void;
  setMeta: (patch: Partial<TimelineMeta>) => void;
  addProject: () => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addTask: (projectId: string, afterTaskId?: string) => string | undefined;
  updateTask: (projectId: string, taskId: string, patch: Partial<Task>) => void;
  deleteTask: (projectId: string, taskId: string) => void;
  setTasksStartDate: (taskIds: string[], date: string) => void;
  /**
   * The way to change task dates: applies the edit plus its follow cascade in one undo step.
   * If the result runs past the last visible week and no `choice` is given, nothing changes
   * and the overflow details are returned so the UI can ask the user.
   */
  commitDateChange: (edit: DateEdit, choice?: OverflowChoice) => OverflowInfo | null;
  addDependency: (childId: string, parentId: string) => { ok: true } | { ok: false; reason: LinkRejection };
  setDependencyFollow: (childId: string, parentId: string, follow: boolean) => void;
  removeDependency: (childId: string, parentId: string) => void;
  moveProject: (fromIdx: number, toIdx: number) => void;
  moveTask: (fromProjectId: string, fromIdx: number, toProjectId: string, toIdx: number) => void;
  toggleHoliday: (date: string) => void;
  setHolidays: (dates: string[]) => void;
  renameVersion: (versionId: string, name: string) => Promise<void>;
  deleteVersion: (versionId: string) => Promise<void>;
  saveVersion: (name: string, note?: string) => Promise<void>;
  restoreVersion: (versionId: string, backupCurrent?: boolean) => Promise<void>;
}

export const useTimelineStore = create<TimelineStore>()(
  temporal(
    (set, get) => ({
      timeline: null,
      editorSession: null,
      saveStatus: 'idle',

      setTimeline: (tl) => set({ timeline: tl }),
      setEditorSession: (session) => set({ editorSession: session }),
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
            const removed = state.timeline.projects.find((p) => p.id === id);
            state.timeline.projects = state.timeline.projects.filter((p) => p.id !== id);
            if (removed) removeReferences(state.timeline.projects, new Set(removed.tasks.map((t) => t.id)));
          })
        ),

      addTask: (projectId, afterTaskId) => {
        let newTaskId: string | undefined;

        set(
          produce((state: TimelineStore) => {
            const p = state.timeline?.projects.find((x) => x.id === projectId);
            if (!p) return;

            const anchorIndex = afterTaskId
              ? p.tasks.findIndex((task) => task.id === afterTaskId)
              : p.tasks.length - 1;
            const anchorTask = anchorIndex >= 0 ? p.tasks[anchorIndex] : undefined;
            const startDate = anchorTask?.endDate ?? state.timeline?.startDate ?? '';

            newTaskId = newId('t');

            p.tasks.splice(anchorIndex + 1, 0, {
              id: newTaskId,
              name: 'New Task',
              status: 'Not Started',
              priority: 'MED',
              color: null,
              owner: '',
              startDate,
              endDate: startDate,
              deliverable: '',
              percentComplete: 0,
            });
            p.expanded = true;
          })
        );

        return newTaskId;
      },

      updateTask: (projectId, taskId, patch) => {
        const { startDate, endDate, ...rest } = patch;
        const dates = {
          ...(startDate !== undefined ? { startDate } : {}),
          ...(endDate !== undefined ? { endDate } : {}),
        };
        set((state) => {
          if (!state.timeline) return {};
          let timeline = produce(state.timeline, (draft) => {
            const t = draft.projects.find((x) => x.id === projectId)?.tasks.find((x) => x.id === taskId);
            if (t) Object.assign(t, rest);
          });
          // Date fields go through the shared path so followers move too.
          if (Object.keys(dates).length > 0) timeline = applyDateEdit(timeline, { kind: 'task', taskId, patch: dates });
          return { timeline };
        });
      },

      deleteTask: (projectId, taskId) =>
        set(
          produce((state: TimelineStore) => {
            const p = state.timeline?.projects.find((x) => x.id === projectId);
            if (!p || !state.timeline) return;
            p.tasks = p.tasks.filter((t) => t.id !== taskId);
            removeReferences(state.timeline.projects, new Set([taskId]));
          })
        ),

      // One set() call so the whole bulk edit is a single undo step.
      setTasksStartDate: (taskIds, date) =>
        set((state) =>
          state.timeline && taskIds.length > 0
            ? { timeline: applyDateEdit(state.timeline, { kind: 'bulkStart', taskIds, date }) }
            : {}
        ),

      commitDateChange: (edit, choice) => {
        const before = get().timeline;
        if (!before) return null;
        const next = applyDateEdit(before, edit);
        const info = overflowInfo(before, next);
        if (info && !choice) return info;
        set({ timeline: info && choice ? resolveOverflow(before, next, choice) : next });
        return null;
      },

      addDependency: (childId, parentId) => {
        const timeline = get().timeline;
        if (!timeline) return { ok: false, reason: 'missing' };
        const check = canLink(timeline.projects, childId, parentId);
        if (!check.ok) return check;
        set(
          produce((state: TimelineStore) => {
            const t = state.timeline?.projects.flatMap((p) => p.tasks).find((x) => x.id === childId);
            if (t) t.dependsOn = [...(t.dependsOn ?? []), { taskId: parentId, follow: true }];
          })
        );
        return { ok: true };
      },

      setDependencyFollow: (childId, parentId, follow) =>
        set(
          produce((state: TimelineStore) => {
            const t = state.timeline?.projects.flatMap((p) => p.tasks).find((x) => x.id === childId);
            const dep = t?.dependsOn?.find((d) => d.taskId === parentId);
            if (dep) dep.follow = follow;
          })
        ),

      removeDependency: (childId, parentId) =>
        set(
          produce((state: TimelineStore) => {
            const t = state.timeline?.projects.flatMap((p) => p.tasks).find((x) => x.id === childId);
            if (!t?.dependsOn) return;
            const kept = t.dependsOn.filter((d) => d.taskId !== parentId);
            if (kept.length > 0) t.dependsOn = kept;
            else delete t.dependsOn;
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

      moveTask: (fromProjectId, fromIdx, toProjectId, toIdx) =>
        set(
          produce((state: TimelineStore) => {
            const fromProject = state.timeline?.projects.find((x) => x.id === fromProjectId);
            const toProject = state.timeline?.projects.find((x) => x.id === toProjectId);
            if (!fromProject || !toProject) return;
            if (fromIdx < 0 || fromIdx >= fromProject.tasks.length) return;

            const [item] = fromProject.tasks.splice(fromIdx, 1);
            if (!item) return;

            const insertAt = Math.max(0, Math.min(toIdx, toProject.tasks.length));
            toProject.tasks.splice(insertAt, 0, item);
            fromProject.expanded = true;
            toProject.expanded = true;
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

      setHolidays: (dates) =>
        set(
          produce((state: TimelineStore) => {
            if (!state.timeline) return;
            state.timeline.holidays = [...dates];
          })
        ),

      renameVersion: async (versionId, name) => {
        const state = useTimelineStore.getState();
        if (!state.timeline || !state.editorSession || !name.trim()) return;

        const session = await getTimelineAdapter(state.editorSession).renameVersion(
          { timeline: state.timeline, session: state.editorSession },
          versionId,
          name
        );

        set({ editorSession: session, saveStatus: 'idle' });
      },

      deleteVersion: async (versionId) => {
        const state = useTimelineStore.getState();
        if (!state.timeline || !state.editorSession) return;

        const session = await getTimelineAdapter(state.editorSession).deleteVersion(
          { timeline: state.timeline, session: state.editorSession },
          versionId
        );

        set({ editorSession: session, saveStatus: 'idle' });
      },

      saveVersion: async (name, note) => {
        const state = useTimelineStore.getState();
        if (!state.timeline || !state.editorSession) return;

        const session = await getTimelineAdapter(state.editorSession).saveVersion(
          { timeline: state.timeline, session: state.editorSession },
          name,
          note
        );

        set({ editorSession: session, saveStatus: 'idle' });
      },

      restoreVersion: async (versionId, backupCurrent = true) => {
        const state = useTimelineStore.getState();
        if (!state.timeline || !state.editorSession) return;

        const restored = await getTimelineAdapter(state.editorSession).restoreVersion(
          { timeline: state.timeline, session: state.editorSession },
          versionId,
          backupCurrent
        );

        set({
          timeline: restored.timeline,
          editorSession: restored.session,
          saveStatus: 'idle',
        });
        useTimelineStore.temporal.getState().clear();
      },
    }),
    {
      limit: 50,
      partialize: (s) => ({ timeline: s.timeline }),
      equality: (a, b) => a.timeline === b.timeline,
      handleSet: (handleSet) => (pastState, _replace, currentState) => {
        // Don't track transitions into a null timeline (page leave / unmount).
        if (currentState && currentState.timeline === null) return;
        handleSet(pastState);
      },
    }
  )
);
