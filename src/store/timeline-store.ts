import { create } from 'zustand';
import { temporal } from 'zundo';
import { produce } from 'immer';
import type { Timeline, TimelineMeta, Project, Task, TimelineVersion } from '@/lib/types';
import { newId } from '@/lib/id';
import { versionsRepo } from '@/lib/db/versions';
import { timelineRepo } from '@/lib/db/timelines';
import type { EditorSession } from '@/lib/timeline-file';
import { VERSION_SCHEMA_VERSION } from '@/lib/db/schema';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function computeVersionStats(projects: Project[]) {
  return {
    projectCount: projects.length,
    taskCount: projects.reduce((sum, project) => sum + project.tasks.length, 0),
  };
}

function buildInMemoryVersion(timeline: Timeline, name: string, note?: string): TimelineVersion {
  const snapshot = structuredClone({
    projects: timeline.projects,
    holidays: timeline.holidays,
  });

  return {
    id: newId('v'),
    timelineId: timeline.id,
    name: name.trim(),
    note: note?.trim() || undefined,
    createdAt: Date.now(),
    schemaVersion: VERSION_SCHEMA_VERSION,
    snapshot,
    stats: computeVersionStats(snapshot.projects),
  };
}

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
  moveProject: (fromIdx: number, toIdx: number) => void;
  moveTask: (fromProjectId: string, fromIdx: number, toProjectId: string, toIdx: number) => void;
  toggleHoliday: (date: string) => void;
  renameVersion: (versionId: string, name: string) => Promise<void>;
  deleteVersion: (versionId: string) => Promise<void>;
  saveVersion: (name: string, note?: string) => Promise<void>;
  restoreVersion: (versionId: string, backupCurrent?: boolean) => Promise<void>;
}

export const useTimelineStore = create<TimelineStore>()(
  temporal(
    (set) => ({
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
            state.timeline.projects = state.timeline.projects.filter((p) => p.id !== id);
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

      renameVersion: async (versionId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        const session = useTimelineStore.getState().editorSession;
        if (session?.mode === 'file') {
          set(
            produce((state: TimelineStore) => {
              if (state.editorSession?.mode !== 'file') return;
              const version = state.editorSession.versions.find((entry) => entry.id === versionId);
              if (!version) return;
              version.name = trimmed;
              state.saveStatus = 'idle';
            })
          );
          return;
        }

        await versionsRepo.rename(versionId, trimmed);
      },

      deleteVersion: async (versionId) => {
        const session = useTimelineStore.getState().editorSession;
        if (session?.mode === 'file') {
          set(
            produce((state: TimelineStore) => {
              if (state.editorSession?.mode !== 'file') return;
              state.editorSession.versions = state.editorSession.versions.filter((entry) => entry.id !== versionId);
              state.saveStatus = 'idle';
            })
          );
          return;
        }

        await versionsRepo.remove(versionId);
      },

      saveVersion: async (name, note) => {
        const tl = useTimelineStore.getState().timeline;
        if (!tl) return;

        const session = useTimelineStore.getState().editorSession;
        if (session?.mode === 'file') {
          const version = buildInMemoryVersion(tl, name, note);
          set(
            produce((state: TimelineStore) => {
              if (state.editorSession?.mode !== 'file') return;
              state.editorSession.versions.unshift(version);
              state.saveStatus = 'idle';
            })
          );
          return;
        }

        await versionsRepo.create(tl.id, name, note);
      },

      restoreVersion: async (versionId, backupCurrent = true) => {
        const tl = useTimelineStore.getState().timeline;
        if (!tl) return;

        const session = useTimelineStore.getState().editorSession;
        if (session?.mode === 'file') {
          set(
            produce((state: TimelineStore) => {
              if (!state.timeline || state.editorSession?.mode !== 'file') return;
              const version = state.editorSession.versions.find((entry) => entry.id === versionId);
              if (!version) return;

              if (backupCurrent) {
                state.editorSession.versions.unshift(
                  buildInMemoryVersion(
                    state.timeline,
                    `Before restore "${version.name}"`,
                    `Auto-saved on ${new Date().toLocaleString()}`
                  )
                );
              }

              state.timeline.projects = structuredClone(version.snapshot.projects);
              state.timeline.holidays = structuredClone(version.snapshot.holidays);
              state.timeline.updatedAt = Date.now();
              Object.assign(state.timeline, computeVersionStats(state.timeline.projects));
              state.saveStatus = 'idle';
            })
          );
          useTimelineStore.temporal.getState().clear();
          return;
        }

        await versionsRepo.restore(versionId, { backupCurrent });
        const refreshed = await timelineRepo.get(tl.id);
        if (refreshed) {
          set({ timeline: refreshed });
          useTimelineStore.temporal.getState().clear();
        }
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
