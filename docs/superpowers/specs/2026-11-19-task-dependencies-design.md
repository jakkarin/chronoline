# Task dependencies + insert task — design

Source: [jakkarin/chronoline#7](https://github.com/jakkarin/chronoline/issues/7) items 1–3:
- Related start date as another task
- Insert tasks and extend another task related with the inserted task
- Tasks dependency with asking modal (Move or not)

Builds on PR jakkarin/chronoline#8 (Mon–Fri date helpers, bulk start-date edit, `barColumnRange`, selection store). Implementation starts after #8 is merged.

## Intent

When one task slips, the user currently re-dates every task after it by hand. They want:
1. **Links** between tasks, drawn as lines on the Gantt, so a follower can move automatically when the task it follows moves.
2. **Insert task**: add a task into the middle of the schedule and push the affected tasks out of its way, choosing which ones.

The issue's "asking modal (Move or not)" is answered by two things the user chose, not by a per-change prompt:
- each link has a **"follow" switch** (set once on the link, no question on every edit);
- the **Insert task modal** lists the tasks that could be pushed and lets the user tick which ones move.

## Decisions made with the user

- **Day counting:** Mon–Fri only, holidays not skipped (same as the whole app; helpers `snapToWeekday`, `nextWeekday` in `src/lib/date-utils.ts`).
- **Creating links — both ways:**
  - drag from a dot at the right end of a selected bar onto another bar;
  - pick from a searchable list: "Follows: [task ▾]" in the task row, and in the Insert task modal.
- **Follow switch:** clicking a line opens a small popover with a "Move with <parent name>" checkbox and a "Remove link" action. New links start with follow **on**.
- **Insert task:** a separate "Insert task" button opens a modal with the normal task fields plus a "Shift tasks to make room" checkbox and a tick-list of candidate tasks (sketch below).
- **Ticked task that is already running across the insert date** (starts before the new task's start, ends on/after it): **extend its end date**, don't move it.
- **Ticked task that starts on/after the insert date:** move the whole task.
- **Storage (approach A):** links live on the follower task.
- **Where following happens (approach A):** one place in the timeline store, applied on every date change.
- **Insert + links:** followers that the insert would move through a link appear in the tick-list, pre-ticked with a 🔗 "follows <parent>" tag. Unticking one keeps it in place for this insert only; the link stays.
- **Row link button manages links:** shows the link count (e.g. 🔗2); opens a panel listing the task's parents with a follow switch and remove action for each, plus "add link". It is the full fallback when lines can't be drawn (collapsed project, out-of-range bar) or on touch.
- **Timeline overflow:** whenever a change would push any task past the last visible day, a confirm modal appears before applying it (details under "Timeline overflow").

## Goals

- Link any two tasks, across projects too.
- Changing a parent's dates moves followers (follow on) by the same number of weekdays the parent's end moved, both later and earlier; the chain cascades (A→B→C).
- Insert a task and push chosen tasks, as a single undo step together with any cascade.
- Links survive save/reload in IndexedDB mode, Save JSON / Load JSON, direct-edit file save, version save/restore.

## Non-goals (this round)

- Lines in Present mode / PDF export.
- Link types other than "finish → start" (no start-to-start, no lag field).
- Holiday-aware shifting.
- Automatic re-scheduling when a follower is earlier than its parent (no constraint enforcement; links only move things when the parent moves).

## Anti-goals (would make this a failure even if it works)

- Links silently disappearing on import, file save or version restore.
- A date change that moves followers but needs more than one Cmd/Ctrl+Z to undo.
- A cycle (A follows B follows A) causing an infinite loop or a hang.

## Approaches considered

| Decision | Options | Picked | Why |
|---|---|---|---|
| Storage | **A** `task.dependsOn: { taskId, follow }[]` on the follower · **B** `timeline.links[]` | A | Version snapshots, JSON envelope and IndexedDB `timelineData` already carry `projects[].tasks[]`, so links travel for free; only the `Task` type and zod `TaskSchema` change. B needs a new field in every persistence path and silently loses links if one is missed. |
| Following | **A** central in the store on any date change · **B** each UI calls a shift helper | A | Drag, DatePicker, bulk edit and insert all get it, in the same `set()` (one undo step). B breaks the first time a new date-editing path forgets to call it. |
| Creating links | drag · list picker · both | both (user) | Drag is fast for nearby bars; the list works at any distance and on touch. |

## Data model

`src/lib/types.ts`:

```ts
export interface TaskDependency {
  taskId: string;   // the parent (the task this one follows)
  follow: boolean;  // move with the parent when its dates change
}

export interface Task {
  // …existing fields
  dependsOn?: TaskDependency[];
}
```

- Optional, so existing data/files without it stay valid.
- A task may follow several parents (the list picker and drag both add to the list; no duplicates of the same parent).
- `src/features/io/import-json.ts` `TaskSchema` must add `dependsOn: z.array(z.object({ taskId: z.string(), follow: z.boolean() })).optional()`. **zod strips unknown keys, so missing this drops every link on import.** Links pointing at task IDs that don't exist are dropped during import (clean, don't reject the file); the timeline is checked against its own tasks and each version snapshot against that snapshot's own tasks. *(builder call)*
- `VERSION_SCHEMA_VERSION` stays 1: the field is optional and additive; older snapshots simply have no links.
- Duplicating a timeline keeps task IDs (`timelineRepo.duplicate`), so links stay valid without remapping.

## Behaviour

### Following (store)

When a task's `endDate` changes from `oldEnd` to `newEnd` through any store action:
- `delta` = signed number of Mon–Fri days from `oldEnd` to `newEnd` (0 if equal; weekends don't count).
- Every task that lists this task in `dependsOn` with `follow: true` moves **both** its start and end by `delta` weekdays (keeps its duration and its gap). Then recurse with that follower's own end change.
- A task reached by two paths in one cascade moves once, by the largest delta that reaches it (deterministic, avoids double moves).
- Cycle-safe: track visited IDs; never revisit.
- A task that the triggering edit itself changes (directly edited, bulk-edited, or ticked in Insert) is never shifted again by the cascade: the direct change wins. *(builder call)*
- Only `endDate` changes trigger following. A start-only change (resize-left) doesn't move followers.
- Weekend handling: shifting by weekdays always lands on a weekday; if a follower's stored date is a weekend (legacy data), shift from `snapToWeekday` of it.
- All of the above runs inside the same `set(produce(...))` as the edit that caused it → **one undo step**.

Store actions that change dates and must apply following: `updateTask` (when `startDate`/`endDate` in the patch), `setTasksStartDate` (bulk; end can move via the push-end rule), `insertTask` (below).

### Creating / editing links

- **Drag:** when a bar is selected (existing click-to-select in `gantt-bar.tsx`), show a small dot just past its right end. Pointer-drag from the dot draws a temporary line following the pointer; releasing over another task's bar creates `dependsOn: { taskId: <dragged-from>, follow: true }` on the target. Releasing elsewhere cancels. Must not trigger the bar's move/resize. (The bar uses `overflow: hidden`; the dot needs to render outside it.)
- **Row link button:** a small button in the task row (placement left to builder, must not shift frozen-column offsets) shows 🔗 plus the number of parents when there are any. It opens a panel:
  - each current parent: name (and project), "Move with parent" switch, remove button;
  - "Add link": searchable list of the other tasks grouped by project; picking one adds a dependency with `follow: true`.
  The same searchable list is the "Follows" field in the Insert task modal.
- **Rejected links:** linking a task to itself, a duplicate parent, or a link that would create a cycle → not created; show a short toast saying why. The cycle check counts follow-off links too, so switching follow on later can never create a cycle. *(builder call)*
- **Creating a link never changes any dates.**
- **Line popover:** clicking a line opens a popover with: "Move with <parent name>" checkbox (toggles `follow`), and "Remove link". A follow-off line is drawn dashed so the state is visible.
- **Deleting a task** removes it from every other task's `dependsOn`. Deleting a project does the same for all its tasks. Same undo step as the delete.

### Drawing lines

- One absolutely positioned `<svg>` layer over the Gantt area inside the table's scroll container (`[data-table-wrap]`), behind the bars' interactive handles but above cell backgrounds.
- Positions come from measuring the rendered bars/rows (the table has project rows, add-task rows and collapsible projects), re-measured on timeline change, expand/collapse, freeze toggle, window resize (ResizeObserver).
- Path: from the parent bar's right edge (vertical middle) to the follower bar's left edge, as an elbow (horizontal → vertical → horizontal) with a small arrowhead.
- If either end isn't drawn (collapsed project, no visible bar via `barColumnRange` = null), skip that line.
- Line hit area wider than the stroke (transparent wide stroke) so it's clickable; frozen columns must stay above the SVG when Freeze is on.
- Light/dark theme via existing CSS tokens.

### Insert task

New toolbar button **"Insert task"** (next to existing actions) opens a dialog (shadcn `dialog`, already present):

```
┌─ Insert task ─────────────────────────────────┐
│ Name    [Design Review          ]             │
│ Project [Frontend ▾]   Owner [        ]       │
│ Follows [— none — ▾]                          │
│ Start   [11/05/2026]   End [13/05/2026]  3 days│
│                                               │
│ [✓] Shift tasks to make room                  │
│   Frontend                                    │
│    [✓] Dashboard Page     11–15 May → 14–20   │
│    [✓] Detail Page        18–22 May → 21–27   │
│    [ ] Component Library   1–15 May → 1–20    │
│   Backend                                     │
│    [ ] Core API            4–22 May → 4–27    │
│                                [Cancel] [Insert]│
└───────────────────────────────────────────────┘
```

- Fields: name, project, owner, status/priority defaults like `addTask` (`Not Started`, `MED`), start, end, optional "Follows". Choosing "Follows" pre-fills start = `nextWeekday(parent.endDate)` and keeps the duration; user can still edit.
- Start/end snap weekends with `snapToWeekday`; end before start isn't allowed (Insert disabled with a hint).
- `N` = the new task's length in Mon–Fri days, inclusive (`workingDaysBetween` without holidays, or an equivalent helper).
- **Candidate list:** every task in the timeline whose `endDate >= new start`, grouped by project in table order. Each row shows current → new dates.
- **Pre-ticked:** tasks in the chosen project with `startDate >= new start`. Everything else unticked.
- **Linked followers in the list:** the preview runs the same cascade function as the store. Any task the cascade would move from the currently ticked set (follow on) is listed too, even if it isn't otherwise a candidate, pre-ticked and tagged 🔗 "follows <parent>". Unticking it keeps it in place for this insert only (the cascade stops there; the link stays). Ticking/unticking re-runs the preview.
- **Unticking the master checkbox** hides/ignores the list.
- **On Insert, for each ticked task:**
  - `startDate < new start` (running across it) → `endDate` += N weekdays (extend).
  - otherwise → `startDate` and `endDate` += N weekdays (move).
- The new task is inserted into the chosen project **in date order** (before the first task whose start is after the new start; at the end otherwise) and gets `dependsOn` if "Follows" was set.
- Ticked tasks (including 🔗 followers left ticked) move exactly as previewed; unticked tasks don't move. Each task is shifted once.
- The new task's row position is chosen by date after the shifts are applied. *(builder call)*
- Everything (new task, shifts, cascade) is one store action `insertTask(...)` → one undo step. `taskCount` updates through the normal save path.

### Timeline overflow (confirm before extending)

Applies to every action that can move dates: drag/resize, row DatePickers, bulk start date, following cascade, Insert.

- Before applying, compute the result (pure function). If any task's `endDate` would fall after the last visible day (Friday of week `weeks`), don't apply yet; open a confirm modal:

```
┌─ Extend timeline? ─────────────────────────────────────┐
│ This change pushes 1 task past the last week.          │
│ Extend the timeline from 10 to 11 weeks?               │
│                                                        │
│ If not extended, these stop at the edge (3 Jul),       │
│ keep their length, and may overlap other tasks:        │
│   Production Deploy   29 Jun – 3 Jul                   │
│                                                        │
│ [Cancel change] [Don't extend (stop at edge)] [Extend] │
└────────────────────────────────────────────────────────┘
```

- **Extend:** apply the change and set `weeks` to the smallest count that fits every task, capped at 52 (the existing `generateColumns` limit). Same `set()` → one undo step. If 52 isn't enough, the modal says so and tasks still beyond week 52 are handled as "Don't extend".
- **Don't extend (stop at edge):** apply the change, but every task whose end would pass the last visible day gets `endDate` = last visible day and `startDate` moved back so its length in weekdays is unchanged (if longer than the whole grid, start = first visible day). Overlap with other tasks is accepted. One undo step.
- **Cancel change:** nothing changes; a dragged bar snaps back.
- For Insert, the modal appears after pressing Insert; Cancel returns to the Insert modal with inputs intact.
- Followers pushed by the cascade count the same as directly moved tasks.
- The modal is transient UI state (not in the undo stack).

## Constraints

- AGENTS.md rules: date-fns only, `@/` imports, strict TS, no transient UI state in the undo stack, persistence only through existing adapters, `updatedAt`/counts correct.
- Direct-edit (file) mode: no autosave; links are written on explicit Save like everything else.
- No new runtime dependencies (SVG and pointer events are enough; shadcn dialog/popover already present).

## Testing expectations

- Unit (vitest, node): weekday delta and shift helpers; cascade (chain, diamond, cycle, follow off, cross-project, directly-edited task not re-shifted); insert candidate list, pre-tick rule, 🔗 followers listed and unticked; extend vs move; overflow detection, extend-to-fit (incl. 52 cap), stop-at-edge keeping length; import keeps valid links and drops dangling ones (timeline and each version snapshot against its own tasks); delete removes references; each store action is one undo step.
- Browser (Playwright, manual scripts as in #8): drag-to-link, row link panel (add/toggle/remove), line popover toggle/remove, drag a parent and see followers move, insert with ticks and 🔗 followers, overflow modal (each button), undo once, collapse/expand and freeze with lines, save/reload.

## Left to the builder

- Exact visuals: dot size, line color/arrowhead, dashed style for follow-off, popover layout.
- Placement of the row "link" button and the toolbar "Insert task" button.
- Toast wording for rejected links.
- How measurement for the SVG layer is organised (hook vs component), as long as it updates on the events listed.
