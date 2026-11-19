import { produce } from 'immer';
import { bulkStartDatePatch } from '@/lib/bulk-edit';
import { cascadeFollowers, type TaskDates } from '@/lib/dependencies';
import { applyInsertToDraft, type InsertInput } from '@/lib/insert-task';
import { detectOverflow, MAX_WEEKS, stopAtEdge, visibleRange } from '@/lib/timeline-overflow';
import type { Task, Timeline } from '@/lib/types';

/** Every way task dates can change. All of them go through `applyDateEdit`. */
export type DateEdit =
  | { kind: 'task'; taskId: string; patch: Partial<TaskDates> }
  | { kind: 'bulkStart'; taskIds: string[]; date: string }
  | { kind: 'insert'; input: InsertInput; ticked: string[]; unticked: string[] };

export type OverflowChoice = 'extend' | 'stopAtEdge';

export interface OverflowInfo {
  taskIds: string[];
  fromWeeks: number;
  /** Week count "Extend" would set (capped at MAX_WEEKS). */
  toWeeks: number;
  /** Even MAX_WEEKS isn't enough; the rest stop at the edge. */
  beyondCap: boolean;
  /** Where each overflowing task lands if the user picks "Don't extend". */
  edgePreview: { taskId: string; dates: TaskDates }[];
}

const allTasks = (tl: Timeline): Task[] => tl.projects.flatMap((p) => p.tasks);

/**
 * Apply a date edit and the follow cascade it causes. Directly edited tasks are
 * locked so the cascade never moves them again. Pure (returns a new timeline).
 */
export function applyDateEdit(timeline: Timeline, edit: DateEdit): Timeline {
  return produce(timeline, (draft) => {
    const tasks = new Map(allTasks(draft).map((t) => [t.id, t]));
    const oldEnds = new Map(allTasks(draft).map((t) => [t.id, t.endDate]));
    const edited = new Set<string>();

    if (edit.kind === 'task') {
      const t = tasks.get(edit.taskId);
      if (!t) return;
      Object.assign(t, edit.patch);
      edited.add(t.id);
    } else if (edit.kind === 'bulkStart') {
      for (const id of edit.taskIds) {
        const t = tasks.get(id);
        if (!t) continue;
        Object.assign(t, bulkStartDatePatch(t, edit.date));
        edited.add(id);
      }
    } else {
      // Insert computes its own cascade (preview and apply must match), so nothing more to do here.
      applyInsertToDraft(draft, edit.input, new Set(edit.ticked), new Set(edit.unticked));
      return;
    }

    const endChanges = new Map<string, { oldEnd: string; newEnd: string }>();
    for (const id of edited) {
      const t = tasks.get(id)!;
      const oldEnd = oldEnds.get(id)!;
      if (t.endDate !== oldEnd) endChanges.set(id, { oldEnd, newEnd: t.endDate });
    }
    for (const [id, dates] of cascadeFollowers(draft.projects, endChanges, edited)) {
      Object.assign(tasks.get(id)!, dates);
    }
  });
}

/** Overflow details for `next` (already edited) relative to `before`, or null if it fits. */
export function overflowInfo(before: Timeline, next: Timeline): OverflowInfo | null {
  const ov = detectOverflow(next.projects, next.startDate, next.weeks);
  if (!ov) return null;
  const range = visibleRange(next.startDate, next.weeks);
  const byId = new Map(allTasks(next).map((t) => [t.id, t]));
  return {
    taskIds: ov.taskIds,
    fromWeeks: before.weeks,
    toWeeks: Math.min(MAX_WEEKS, Math.max(next.weeks, ov.weeksNeeded)),
    beyondCap: ov.weeksNeeded > MAX_WEEKS,
    edgePreview: ov.taskIds.map((taskId) => ({ taskId, dates: stopAtEdge(byId.get(taskId)!, range) })),
  };
}

/** Resolve overflow in `next` per the user's choice. */
export function resolveOverflow(next: Timeline, choice: OverflowChoice): Timeline {
  const ov = detectOverflow(next.projects, next.startDate, next.weeks);
  if (!ov) return next;
  return produce(next, (draft) => {
    if (choice === 'extend') draft.weeks = Math.min(MAX_WEEKS, Math.max(draft.weeks, ov.weeksNeeded));
    const range = visibleRange(draft.startDate, draft.weeks);
    for (const t of allTasks(draft)) {
      if (t.endDate > range.last) Object.assign(t, stopAtEdge(t, range));
    }
  });
}
