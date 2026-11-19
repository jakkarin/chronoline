# Task Dependencies + Insert Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link tasks with "follow" lines that move followers when a parent moves, add an Insert task flow that pushes chosen tasks, and confirm before any change extends the timeline.

**Architecture:** All date rules are pure functions in three new `src/lib` modules (`dependencies.ts`, `timeline-overflow.ts`, `insert-task.ts`) with vitest coverage. One store entry point, `commitDateChange`, applies any date edit plus its follow-cascade plus the overflow choice in a single `set()` (one undo step); it returns overflow info instead of applying when the caller hasn't chosen yet. UI pieces (SVG line layer, link drag, row link panel, Insert dialog, overflow dialog) call the store and never compute dates themselves.

**Tech Stack:** React 19, TypeScript 6, Zustand 5 + zundo + Immer, date-fns 4, zod 4, shadcn/ui (base-ui dialog, alert-dialog, popover), sonner, Vitest 5, Playwright scripts for browser checks.

**Spec:** `docs/superpowers/specs/2026-11-19-task-dependencies-design.md`

## Global Constraints

- Day counting is Mon–Fri; holidays are not skipped. Weekend inputs snap with `snapToWeekday` (`@/lib/date-utils`).
- Dates are `YYYY-MM-DD` strings; date-fns only, no raw `Date` arithmetic. `@/` imports, strict TS, no `any`.
- Every date change, its cascade and any `weeks` change happen in one `set()` → one undo step.
- Transient UI state (pending overflow prompt, link-drag state, open popovers) never enters the zundo-tracked store.
- `weeks` never exceeds 52.
- New links start with `follow: true`. Creating a link never changes dates.
- No new runtime dependencies.
- Base: this work starts from `main` after PR jakkarin/chronoline#8 is merged (it relies on `snapToWeekday`, `nextWeekday`, `barColumnRange`, `setTasksStartDate`, `selectExistingIds`). Copy the spec into `docs/superpowers/specs/` and this plan into `docs/superpowers/plans/` in the first commit.

## Review Focus

1. **Link that targets a hidden task** (collapsed project or bar outside the grid): no line, but the row 🔗 panel still lists and removes it, and following still works. (Task 9 browser check step.)
2. **Overflow "Cancel change" after a bar drag**: the bar returns to its original position, dates unchanged, nothing added to undo. (Task 6 browser check step.)
3. **Undo after a cascade that also extended `weeks`**: one Cmd/Ctrl+Z restores dates *and* the week count. (Task 5 test `commitDateChange extend is one undo step incl. weeks`.)
4. **Import of a file whose links point at missing tasks**: file loads, dangling links dropped, valid links kept. (Task 2 test `drops dangling links in timeline and each version`.)
5. **Deleting a task that others follow**: followers stay put and their 🔗 count drops; undo brings the link back. (Task 5 test `deleteTask removes references in the same undo step`.)

---

### Task 1: Types and weekday math

**Files:**
- Modify: `src/lib/types.ts` (add `TaskDependency`, `Task.dependsOn?`)
- Create: `src/lib/dependencies.ts`
- Create: `src/lib/dependencies.test.ts`

**Interfaces:**
- Produces (types): `TaskDependency { taskId: string; follow: boolean }`; `Task.dependsOn?: TaskDependency[]`; `TaskDates = Pick<Task, 'startDate' | 'endDate'>` exported from `dependencies.ts`.
- Produces (`@/lib/dependencies`):
  - `weekdayDelta(from: string, to: string): number` — signed count of Mon–Fri steps from `from` to `to` (both snapped with `snapToWeekday` first).
  - `shiftWeekdays(date: string, n: number): string` — snap, then move `n` weekdays (negative = earlier).
  - `weekdayLength(start: string, end: string): number` — inclusive Mon–Fri count (≥1 when end ≥ start).

- [ ] **Step 1: Failing tests** in `dependencies.test.ts`:
  - `weekdayDelta('2026-11-20','2026-11-23') === 1` (Fri→Mon); `('2026-11-23','2026-11-20') === -1`; `('2026-11-18','2026-11-18') === 0`; `('2026-11-16','2026-11-30') === 10`; `('2026-11-21','2026-11-24') === 1` (Sat snaps to Mon).
  - `shiftWeekdays('2026-11-20', 1) === '2026-11-23'`; `('2026-11-23', -1) === '2026-11-20'`; `('2026-11-18', 0) === '2026-11-18'`; `('2026-11-22', 0) === '2026-11-23'`; `('2026-12-30', 3) === '2027-01-04'`.
  - `weekdayLength('2026-11-16','2026-11-20') === 5`; `('2026-11-20','2026-11-23') === 2`; `('2026-11-18','2026-11-18') === 1`.
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3:** Add the types; implement the three functions with date-fns (`addBusinessDays`, `differenceInBusinessDays`) after `snapToWeekday`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add task dependency types and weekday math`.

---

### Task 2: Import keeps links, drops dangling ones

**Files:**
- Modify: `src/features/io/import-json.ts` (`TaskSchema`, post-parse cleanup)
- Modify: `src/lib/dependencies.ts`
- Create: `src/features/io/import-json.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `dropDanglingDependencies(projects: Project[]): Project[]` in `@/lib/dependencies` — returns projects where every `dependsOn` entry points at a task ID present in `projects` and isn't self/duplicate; empty arrays become `undefined`.

- [ ] **Step 1: Failing tests:**
  - `dependencies.test.ts` › `dropDanglingDependencies keeps valid, drops missing/self/duplicate`.
  - `import-json.test.ts` › `keeps dependsOn on import` (envelope JSON with task `t_2` `dependsOn: [{taskId:'t_1', follow:false}]` → parsed task has it).
  - `import-json.test.ts` › `drops dangling links in timeline and each version` (timeline link to `t_gone` dropped; a version snapshot whose task links to a task that exists only in the current timeline but not in that snapshot is dropped there).
  - `import-json.test.ts` › `files without dependsOn still import`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Add `dependsOn: z.array(z.object({ taskId: z.string(), follow: z.boolean() })).optional()` to `TaskSchema`; in `parseImportJSON` run `dropDanglingDependencies` on `timeline.projects` and on each `version.snapshot.projects` separately.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: keep task links on JSON import`.

---

### Task 3: Link graph and follow cascade

**Files:**
- Modify: `src/lib/dependencies.ts`, `src/lib/dependencies.test.ts`

**Interfaces:**
- Consumes: `weekdayDelta`, `shiftWeekdays` (Task 1).
- Produces:
  - `wouldCreateCycle(projects: Project[], childId: string, parentId: string): boolean` — true if `parentId` already (transitively, any `follow` value) depends on `childId`, or `childId === parentId`.
  - `canLink(projects, childId, parentId): { ok: true } | { ok: false; reason: 'self' | 'duplicate' | 'cycle' | 'missing' }`.
  - `cascadeFollowers(projects: Project[], endChanges: Map<string, { oldEnd: string; newEnd: string }>, locked: ReadonlySet<string>): Map<string, TaskDates>` — new dates for every follower reached through `follow: true` links. Rules: delta = `weekdayDelta(oldEnd,newEnd)` of the parent; follower start and end both `shiftWeekdays` by delta; recurse with the follower's own end change; a task reached twice uses the largest |delta| (ties: the positive one); tasks in `locked` (directly edited) are never shifted and the cascade does not pass through them; visited-set cycle guard; delta 0 stops.
  - `removeReferences(projects: Project[], removedIds: ReadonlySet<string>): void` — mutates (for Immer drafts): strips matching `dependsOn` entries.

- [ ] **Step 1: Failing tests** (build projects with a small `task(id, start, end, deps?)` helper):
  - `cascade chain A→B→C moves both by parent delta` (A end +3 weekdays → B and C +3, durations kept).
  - `cascade moves earlier too` (A end −2 → B −2).
  - `cascade skips follow:false` and `stops at locked task`.
  - `diamond uses largest delta once` (A→C (+2), B→C (+5) both changed → C +5).
  - `cycle in data does not loop` (A↔B with follow → terminates, each shifted at most once).
  - `cross-project follower moves`.
  - `wouldCreateCycle` true for B→A when A follows B (even with follow:false); `canLink` reasons for self, duplicate, cycle, missing.
  - `removeReferences strips links to removed ids`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement (BFS over a child index `parentId → followers` built once per call).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: add link graph and follow cascade`.

---

### Task 4: Overflow detection and resolution

**Files:**
- Create: `src/lib/timeline-overflow.ts`, `src/lib/timeline-overflow.test.ts`

**Interfaces:**
- Consumes: `weekdayLength`, `shiftWeekdays` (Task 1); `generateColumns` (`@/lib/date-utils`).
- Produces:
  - `visibleRange(startDate: string, weeks: number): { first: string; last: string }` (Monday of week 1 … Friday of week `weeks`).
  - `detectOverflow(projects: Project[], startDate: string, weeks: number): { taskIds: string[]; weeksNeeded: number } | null` — tasks with `endDate > last`; `weeksNeeded` = smallest week count containing every end date (uncapped).
  - `MAX_WEEKS = 52`.
  - `stopAtEdge(task: TaskDates, range: { first: string; last: string }): TaskDates` — end = `last`, start moved back to keep `weekdayLength`; if longer than the grid, start = `first`.

- [ ] **Step 1: Failing tests** (timeline start `2026-04-27`, 10 weeks → last `2026-07-03`):
  - `visibleRange` → `{ first:'2026-04-27', last:'2026-07-03' }`.
  - `no overflow returns null`; `end 2026-07-08 → taskIds [id], weeksNeeded 11`.
  - `stopAtEdge keeps length` (`2026-07-02..2026-07-08` (5 days) → `2026-06-29..2026-07-03`).
  - `stopAtEdge longer than grid starts at first`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: add timeline overflow helpers`.

---

### Task 5: Store — commitDateChange, link actions, delete cleanup

**Files:**
- Modify: `src/store/timeline-store.ts`
- Create: `src/store/date-change.ts` (types + pure `applyDateEdit`)
- Modify: `src/store/timeline-store.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4; `bulkStartDatePatch` (`@/lib/bulk-edit`); `planInsert` arrives in Task 7 (leave the `insert` kind for Task 7).
- Produces:
  - `type DateEdit = { kind: 'task'; taskId: string; patch: Partial<TaskDates> } | { kind: 'bulkStart'; taskIds: string[]; date: string } | { kind: 'insert'; input: InsertInput; ticked: string[]; unticked: string[] }` (`InsertInput` from Task 7).
  - `type OverflowChoice = 'extend' | 'stopAtEdge'`.
  - `type OverflowInfo = { taskIds: string[]; fromWeeks: number; toWeeks: number /* capped 52 */; beyondCap: boolean; edgePreview: { taskId: string; dates: TaskDates }[] }`.
  - `applyDateEdit(timeline: Timeline, edit: DateEdit): Timeline` (pure, uses Immer `produce`): applies the edit, then `cascadeFollowers` with every directly edited task in `locked`.
  - Store action `commitDateChange(edit: DateEdit, choice?: OverflowChoice): OverflowInfo | null` — computes `applyDateEdit`; if `detectOverflow` finds tasks and `choice` is undefined → return `OverflowInfo`, state untouched; otherwise apply in one `set()`: `extend` sets `weeks = min(52, weeksNeeded)` and then applies `stopAtEdge` to anything still beyond; `stopAtEdge` applies it to every overflowing task. Returns `null` when applied.
  - `updateTask` and `setTasksStartDate` keep their signatures but route date fields through `applyDateEdit` (cascade, no overflow prompt) so no date path skips following.
  - `addDependency(childId: string, parentId: string): { ok: true } | { ok: false; reason }` (uses `canLink`, pushes `{ taskId: parentId, follow: true }`).
  - `setDependencyFollow(childId: string, parentId: string, follow: boolean): void`; `removeDependency(childId: string, parentId: string): void`.
  - `deleteTask` / `deleteProject` call `removeReferences` in the same `set()`.

- [ ] **Step 1: Failing tests** in `timeline-store.test.ts`:
  - `commitDateChange task end moves followers` (B follows A; A end +2 → B +2).
  - `commitDateChange returns overflow info without changing state` (push past 2026-07-03, no choice → info `{fromWeeks:10,toWeeks:11}`, timeline unchanged).
  - `commitDateChange extend is one undo step incl. weeks` (choice `extend` → weeks 11, dates moved; one `undo()` → weeks 10 and original dates).
  - `commitDateChange stopAtEdge keeps length` (weeks unchanged, task ends 2026-07-03 with same weekday length).
  - `commitDateChange extend caps at 52 and stops the rest at edge`.
  - `bulkStart cascades and directly edited tasks are not re-shifted`.
  - `addDependency rejects cycle` / `defaults follow true` / `does not change dates`.
  - `deleteTask removes references in the same undo step` (undo restores link).
  - `updateTask with endDate cascades`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS (whole suite, incl. existing #8 tests).
- [ ] **Step 5:** Commit `feat: central date-change commit with follow cascade and overflow`.

---

### Task 6: Overflow dialog and wiring existing date UIs

**Files:**
- Create: `src/store/date-change-prompt.ts` (transient zustand store)
- Create: `src/features/timeline/overflow-dialog.tsx`
- Create: `src/features/timeline/request-date-change.ts`
- Modify: `src/features/timeline/timeline-table.tsx` (bar drag, Start/End DatePickers), `src/features/timeline/bulk-action-bar.tsx`, `src/features/timeline/gantt-bar.tsx`, `src/routes/timeline-editor.tsx` (mount dialog)

**Interfaces:**
- Consumes: `commitDateChange`, `DateEdit`, `OverflowInfo`, `OverflowChoice` (Task 5).
- Produces:
  - `useDateChangePrompt`: `{ pending: { edit: DateEdit; info: OverflowInfo; onCancel?: () => void } | null; open(p): void; close(): void }`.
  - `requestDateChange(edit: DateEdit, onCancel?: () => void): void` — calls `commitDateChange(edit)`; if it returns info, `open({ edit, info, onCancel })`.
  - `<OverflowDialog />` (AlertDialog): title "Extend timeline?"; body "This change pushes N task(s) past the last week. Extend the timeline from X to Y weeks?"; list "If not extended, these stop at the edge (d MMM), keep their length, and may overlap other tasks:" with name + new dates from `edgePreview`; when `beyondCap`, add "52 weeks is the maximum; tasks beyond it will stop at the edge." Buttons: `Cancel change` (close + `onCancel`), `Don't extend (stop at edge)` (`commitDateChange(edit,'stopAtEdge')`), `Extend` (`commitDateChange(edit,'extend')`).

- [ ] **Step 1:** Replace date writes: bar `onUpdate` → `requestDateChange({kind:'task', taskId, patch:{startDate,endDate}})`; row Start/End DatePickers → same with one field; bulk bar → `{kind:'bulkStart', ...}`.
- [ ] **Step 2:** `GanttBar.commitDrag`: after calling `onUpdate`, reset the bar's inline `left`/`width` to the props-derived values, so a pending or cancelled change shows the original position (React re-renders new props when a change applies).
- [ ] **Step 3:** Implement the prompt store, `requestDateChange`, `OverflowDialog`; mount the dialog in `timeline-editor.tsx`. Esc on the dialog = Cancel change (and must not clear task selection — it's a base-ui dialog, so the existing Esc guard covers it).
- [ ] **Step 4:** `npx tsc -b --noEmit`, `npm run lint`, `npm test` → clean.
- [ ] **Step 5: Browser check** (Playwright script, sample timeline): drag "Production Deploy" 3 days right → dialog shows 10 → 11 weeks and the edge preview; **Cancel change** → bar back at original columns, dates unchanged, undo stack unchanged; repeat → **Don't extend** → task ends 03/07/2026 with original length; undo; repeat → **Extend** → header shows Wk 11; one Ctrl+Z → Wk 11 gone and dates restored. Bulk start date to a far date triggers the same dialog.
- [ ] **Step 6:** Commit `feat: confirm before date changes extend the timeline`.

---

### Task 7: Insert planning (pure) + store kind

**Files:**
- Create: `src/lib/insert-task.ts`, `src/lib/insert-task.test.ts`
- Modify: `src/store/date-change.ts` (implement `insert` kind), `src/store/timeline-store.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3; `newId('t')` (`@/lib/id`).
- Produces:
  - `InsertInput = { projectId: string; name: string; owner: string; startDate: string; endDate: string; followsTaskId: string | null }`.
  - `InsertCandidate = { taskId: string; projectId: string; mode: 'move' | 'extend'; preTicked: boolean }`.
  - `insertCandidates(projects: Project[], input: InsertInput): InsertCandidate[]` — tasks with `endDate >= input.startDate`, table order; `mode` = `extend` if `startDate < input.startDate` else `move`; `preTicked` = same project and `mode === 'move'`.
  - `planInsert(projects: Project[], input: InsertInput, ticked: ReadonlySet<string>, unticked: ReadonlySet<string>): { patches: Map<string, TaskDates>; followers: { taskId: string; parentId: string }[] }` — N = `weekdayLength(start,end)`; ticked `move` → start/end +N; ticked `extend` → end +N; then `cascadeFollowers` from the ticked end changes with `locked` = ticked ∪ unticked; `followers` lists every task moved by that cascade (for the 🔗 rows).
  - `insert` DateEdit in `applyDateEdit`: applies `planInsert` patches, creates the task (`status 'Not Started'`, `priority 'MED'`, `color null`, `deliverable ''`, `percentComplete 0`, `dependsOn` from `followsTaskId` with `follow: true`), dates snapped with `snapToWeekday`, inserted into its project before the first task whose (post-shift) `startDate` is later, else at the end.

- [ ] **Step 1: Failing tests** (`insert-task.test.ts`, sample-like data: Component Library 05-01..05-15, Dashboard 05-11..05-15, Detail 05-18..05-22 in project Frontend; Core API 05-04..05-22 in Backend; insert 05-11..05-13 into Frontend):
  - `candidates`: Dashboard `move` preTicked, Detail `move` preTicked, Component Library `extend` not ticked, Core API `extend` not ticked; tasks ending before 05-11 excluded.
  - `planInsert move`: Dashboard → 05-14..05-20, Detail → 05-21..05-27.
  - `planInsert extend`: Component Library ticked → 05-01..05-20.
  - `linked follower is shifted and listed` (X follows Dashboard, not a candidate → patch +3 and in `followers`).
  - `unticked follower stays and stops the cascade`.
  - store test `insert is one undo step and places new task by date`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: plan and apply Insert task`.

---

### Task 8: Dependency lines (SVG) + line popover

**Files:**
- Create: `src/features/timeline/dependency-lines.tsx`
- Modify: `src/features/timeline/gantt-bar.tsx` (add `data-bar-task-id`), `src/features/timeline/timeline-table.tsx` (pass task id to bar; mount layer inside `[data-table-wrap]`)

**Interfaces:**
- Consumes: store `timeline`, `setDependencyFollow`, `removeDependency` (Task 5).
- Produces: `<DependencyLines containerRef={RefObject<HTMLDivElement>} />`.

- [ ] **Step 1:** Implement: one absolutely positioned `<svg>` sized to the scroll content; for each `child.dependsOn` entry find both bars by `[data-bar-task-id]`; skip if either is missing; path parent right-middle → child left-middle as an elbow with an arrowhead marker; `follow: false` → dashed. Re-measure on timeline change, freeze toggle and `ResizeObserver` on the table. A transparent ~10px stroke on each path is the click target. Frozen sticky cells stay above the SVG (lower z-index than sticky columns, above cell backgrounds, below bar handles).
- [ ] **Step 2:** Click a line → controlled `Popover` anchored to an invisible element at the click point, content: checkbox "Move with <parent name>" (→ `setDependencyFollow`) and "Remove link" (→ `removeDependency`).
- [ ] **Step 3:** `tsc`, lint, `npm test` clean.
- [ ] **Step 4: Browser check:** seed two links via the store in the page (`useTimelineStore` from the dev module is fine) — one same-project, one cross-project; screenshot light/dark; lines connect the right bars; collapse the parent's project → line hidden, expand → back; Freeze on + scroll → lines pass under frozen columns; clicking a line opens the popover; toggling follow makes it dashed; Remove deletes it.
- [ ] **Step 5:** Commit `feat: draw task links and edit them from the line`.

---

### Task 9: Row link panel + task search list

**Files:**
- Create: `src/features/timeline/task-search-select.tsx`, `src/features/timeline/task-links-panel.tsx`
- Modify: `src/features/timeline/timeline-table.tsx` (button in the "Project + Task" cell, right of the name; must not change frozen offsets)

**Interfaces:**
- Consumes: `addDependency`, `setDependencyFollow`, `removeDependency` (Task 5); `toast` from `sonner`.
- Produces:
  - `<TaskSearchSelect excludeIds={string[]} onSelect={(taskId: string) => void} placeholder?: string />` — text filter + list grouped by project (reused by Task 11).
  - `<TaskLinksPanel taskId={string} />` — trigger shows a link icon, plus the parent count when > 0 (`aria-label` "Links for <task name>"); popover lists each parent (name, project, "Move with parent" switch, remove button) and an "Add link" section with `TaskSearchSelect` (excludes self and current parents). Rejections toast: self → "A task can't follow itself", duplicate → "Already linked", cycle → "That link would create a loop".

- [ ] **Step 1:** Implement both components; wire the button.
- [ ] **Step 2:** `tsc`, lint, tests clean.
- [ ] **Step 3: Browser check:** add a link via the panel → count shows 1 and a line appears; toggle follow → line dashed; try a cycle → toast, nothing added; **collapse the parent's project** → no line, panel still lists the link and Remove works (Review Focus 1); delete a parent task → follower's count drops, undo restores it (Review Focus 5).
- [ ] **Step 4:** Commit `feat: manage task links from the row`.

---

### Task 10: Drag to link from a bar

**Files:**
- Modify: `src/features/timeline/gantt-bar.tsx`, `src/features/timeline/dependency-lines.tsx` (draw temporary line)
- Create: `src/store/link-drag.ts` (transient zustand: `{ fromTaskId: string; x: number; y: number } | null`)

**Interfaces:**
- Consumes: `addDependency` (Task 5), `data-bar-task-id` (Task 8).

- [ ] **Step 1:** When a task bar is selected, render a link dot just past its right edge, outside the bar's `overflow: hidden` box (wrap the bar in a non-clipping container). Pointer-down on the dot → `setPointerCapture`, set `link-drag` state; move → update pointer coords (layer draws a dashed line from the bar's right-middle to the pointer); up → `document.elementFromPoint` → `closest('[data-bar-task-id]')`; if it's another task → `addDependency(targetId, fromTaskId)` (toast on rejection); otherwise cancel. Must not start move/resize.
- [ ] **Step 2:** `tsc`, lint, tests clean.
- [ ] **Step 3: Browser check:** select Requirements Gathering, drag its dot onto Architecture Design → line appears, Architecture's 🔗 shows 1, dates unchanged; dragging onto empty space adds nothing; bar move/resize still work.
- [ ] **Step 4:** Commit `feat: drag from a bar to link tasks`.

---

### Task 11: Insert task dialog

**Files:**
- Create: `src/features/timeline/insert-task-dialog.tsx`
- Modify: `src/features/timeline/toolbar.tsx` (button "Insert task" after "+ Group")

**Interfaces:**
- Consumes: `InsertInput`, `insertCandidates`, `planInsert` (Task 7); `requestDateChange` (Task 6); `TaskSearchSelect` (Task 9); `weekdayLength`, `nextWeekday`, `snapToWeekday`.

- [ ] **Step 1:** Dialog fields: Name, Project (select, default first project), Owner, Follows (`TaskSearchSelect`, optional; choosing one sets start = `nextWeekday(parent.endDate)` and keeps the current length), Start, End (DatePickers, snapped; Insert disabled with "End must be on or after start" when invalid), length "N days". Checkbox "Shift tasks to make room" (default on) → grouped list from `insertCandidates` with current → new dates from `planInsert`; plus 🔗 rows from `planInsert(...).followers` tagged "follows <parent>", pre-ticked. Every tick change re-runs `planInsert`. Unticking a 🔗 row puts it in `unticked`.
- [ ] **Step 2:** Insert → `requestDateChange({ kind:'insert', input, ticked, unticked }, onCancel)`; on apply close; if the overflow dialog opens, keep this dialog's state and reopen it on Cancel change.
- [ ] **Step 3:** `tsc`, lint, tests, `npm run build` clean.
- [ ] **Step 4: Browser check** (sample timeline): insert "Design Review" 11–13 May into Frontend → list matches the spec sketch (Dashboard/Detail ticked, Component Library/Core API unticked); tick Component Library → preview 1–20 May; Insert → dates as previewed, new row placed by date; one Ctrl+Z restores everything. With a link X→Dashboard: X appears with 🔗 ticked; untick → X stays. Insert near the end → overflow dialog → Cancel returns to Insert dialog with inputs kept.
- [ ] **Step 5:** Commit `feat: Insert task dialog`.

---

### Task 12: Persistence round-trip and final verification

**Files:** none new (fix-ups only if checks fail)

- [ ] **Step 1: Browser check:** create links; reload page (IndexedDB) → links and follow states intact; Save JSON → Load JSON → intact; Save version → change links → Restore → links match the version.
- [ ] **Step 2:** `npm test`, `npx tsc -b --noEmit`, `npm run lint`, `npm run build` → all clean.
- [ ] **Step 3:** Update `AGENTS.md`: `Task` row gains `dependsOn`; State Management lists `commitDateChange` as the only way to change task dates; note the overflow dialog.
- [ ] **Step 4:** Commit `docs: describe task links and date-change flow`.
