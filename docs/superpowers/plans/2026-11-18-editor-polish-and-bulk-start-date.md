# Editor Polish + Bulk Start-Date Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable text selection and double-tap zoom, show week date ranges (month) on the editor header, and let users set one start date on many selected tasks at once.

**Architecture:** Date rules live in pure helpers (`date-utils.ts`, new `bulk-edit.ts`) with unit tests. One new zundo-tracked store action applies the bulk edit as a single undo step. Selection is transient UI state in a separate, untracked zustand store, shown as row checkboxes and a floating action bar.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind v4, shadcn/ui (base-ui), Zustand 5 + zundo + Immer, date-fns 4, Vitest 5 (new, dev only).

**Spec:** `docs/superpowers/specs/2026-11-18-editor-polish-and-bulk-start-date-design.md`

## Global Constraints

- Day counting is **Mon–Fri**: skip Sat/Sun, do **not** skip holidays. No counting-mode setting.
- Dates are `YYYY-MM-DD` strings; date math via `date-fns` only — no raw `new Date()` arithmetic (AGENTS.md rule 6).
- Imports use the `@/` alias; strict TS, no `any` / `@ts-ignore` (rules 5, 11).
- Selection state must **not** enter the zundo undo stack (AGENTS.md State Management).
- shadcn components are added via the CLI, not hand-written (rule 4).
- Only new dependency: `vitest` as a devDependency. Reason (rule 10): unit-test the date and bulk-edit rules; no runtime impact.
- Week label format, copied from present mode: `d MMM - d MMM yyyy` (e.g. `30 Nov - 4 Dec 2026`).
- Package manager is pnpm.

## Review Focus

1. **Esc while typing or with a popover open** — pressing Esc inside the task-name input or while the bar's DatePicker is open must close that thing only, not clear the selection. (Task 6, Step 4 check.)
2. **Selected task disappears** (deleted, or undo removes it) — the bar's count and the apply must ignore it, and a selection that becomes empty hides the bar. (Task 3 test `selectExistingIds ignores missing ids`.)
3. **Undo after bulk apply** — one Cmd/Ctrl+Z restores every selected task's start and end dates at once. (Task 6, Step 4 check.)
4. **Inputs still editable** after `user-select: none` — typing, selecting, copy/paste in task name, owner, deliverable, % inputs work. (Task 1, Step 5 check.)
5. **Picking a weekend in the bar's DatePicker** — tasks start the following Monday, never on a weekend. (Task 2 test `snaps a weekend date to Monday`.)

---

### Task 1: Test runner, date helpers, and gesture CSS

**Files:**
- Modify: `package.json` (devDependency + `"test": "vitest run"` script)
- Modify: `vite.config.ts` (add `test` block)
- Modify: `src/lib/date-utils.ts`
- Create: `src/lib/date-utils.test.ts`
- Modify: `src/index.css` (`@layer base`)
- Modify: `AGENTS.md` (Commands: add `npm test`)

**Interfaces:**
- Produces (in `@/lib/date-utils`):
  - `getWeekRangeLabel(monday: Date): string` → `` `${format(monday,'d MMM')} - ${format(addDays(monday,4),'d MMM yyyy')}` ``
  - `snapToWeekday(dateStr: string): string` — Sat/Sun → following Monday; weekdays unchanged.
  - `nextWeekday(dateStr: string): string` — next Mon–Fri day after `dateStr` (Fri/Sat/Sun → Monday).

- [ ] **Step 1: Install Vitest and wire it up**

Run: `pnpm add -D vitest@^5.1.0`
Add script `"test": "vitest run"`. In `vite.config.ts` add `/// <reference types="vitest/config" />` at the top and `test: { include: ['src/**/*.test.ts'], environment: 'node' }` to the config object. Add `npm test` under "Commands" in `AGENTS.md`.

- [ ] **Step 2: Write failing tests in `src/lib/date-utils.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import { getWeekRangeLabel, snapToWeekday, nextWeekday } from '@/lib/date-utils';

describe('getWeekRangeLabel', () => {
  it('formats a Mon–Fri range', () => {
    expect(getWeekRangeLabel(parseISO('2026-11-30'))).toBe('30 Nov - 4 Dec 2026');
  });
  it('puts the end year on a week crossing new year', () => {
    expect(getWeekRangeLabel(parseISO('2026-12-28'))).toBe('28 Dec - 1 Jan 2027');
  });
});

describe('snapToWeekday', () => {
  it('snaps Saturday to Monday', () => expect(snapToWeekday('2026-11-21')).toBe('2026-11-23'));
  it('snaps Sunday to Monday', () => expect(snapToWeekday('2026-11-22')).toBe('2026-11-23'));
  it('keeps a weekday', () => expect(snapToWeekday('2026-11-18')).toBe('2026-11-18'));
});

describe('nextWeekday', () => {
  it('Friday → Monday', () => expect(nextWeekday('2026-11-20')).toBe('2026-11-23'));
  it('Wednesday → Thursday', () => expect(nextWeekday('2026-11-18')).toBe('2026-11-19'));
  it('crosses year end', () => expect(nextWeekday('2026-12-31')).toBe('2027-01-01'));
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `pnpm test`
Expected: FAIL — `getWeekRangeLabel` / `snapToWeekday` / `nextWeekday` not exported.

- [ ] **Step 4: Implement the three helpers in `src/lib/date-utils.ts`**

Use `parseISO`, `addDays`, `isWeekend` / `nextMonday`, `format(…, 'yyyy-MM-dd')`.

- [ ] **Step 5: Run tests, verify they pass**

Run: `pnpm test` → all PASS.

- [ ] **Step 6: Gesture CSS in `src/index.css`**

In `@layer base`: `body` gets `user-select: none; -webkit-user-select: none; touch-action: manipulation;`. Add a rule for `input, textarea, [contenteditable="true"]` restoring `user-select: text; -webkit-user-select: text;`. Do not touch the viewport meta in `index.html`.

- [ ] **Step 7: Check in the browser**

Run `pnpm dev`, open a timeline. Expected: dragging across table text selects nothing; in task name / owner / deliverable / % inputs you can still type, select with mouse, copy and paste. Bar drag still works.

- [ ] **Step 8: Verify and commit**

Run: `npx tsc --noEmit && pnpm lint && pnpm test` → no errors.

```bash
git add package.json pnpm-lock.yaml vite.config.ts AGENTS.md src/lib/date-utils.ts src/lib/date-utils.test.ts src/index.css
git commit -m "feat: add date helpers, vitest, and disable text selection/double-tap zoom"
```

---

### Task 2: Bulk start-date rule + store action

**Files:**
- Create: `src/lib/bulk-edit.ts`
- Create: `src/lib/bulk-edit.test.ts`
- Modify: `src/store/timeline-store.ts`

**Interfaces:**
- Consumes: `snapToWeekday`, `nextWeekday` (Task 1).
- Produces:
  - `bulkStartDatePatch(task: Pick<Task, 'startDate' | 'endDate'>, date: string): Pick<Task, 'startDate' | 'endDate'>` in `@/lib/bulk-edit`.
  - Store action `setTasksStartDate: (taskIds: string[], date: string) => void` on `useTimelineStore`.

Rule: `start = snapToWeekday(date)`; `end = task.endDate >= start ? task.endDate : nextWeekday(start)` (an empty `endDate` counts as before `start`).

- [ ] **Step 1: Write failing tests in `src/lib/bulk-edit.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { bulkStartDatePatch } from '@/lib/bulk-edit';

const t = (startDate: string, endDate: string) => ({ startDate, endDate });

describe('bulkStartDatePatch', () => {
  it('keeps end when it is after the new start', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-27'), '2026-11-18'))
      .toEqual(t('2026-11-18', '2026-11-27')));
  it('keeps end when it equals the new start', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-18'), '2026-11-18'))
      .toEqual(t('2026-11-18', '2026-11-18')));
  it('pushes end to the next weekday when start passes it', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-17'), '2026-11-18'))
      .toEqual(t('2026-11-18', '2026-11-19')));
  it('pushes end from Friday start to Monday', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-17'), '2026-11-20'))
      .toEqual(t('2026-11-20', '2026-11-23')));
  it('snaps a weekend date to Monday', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-17'), '2026-11-21'))
      .toEqual(t('2026-11-23', '2026-11-24')));
  it('snaps a weekend date and keeps a later end', () =>
    expect(bulkStartDatePatch(t('2026-11-16', '2026-11-27'), '2026-11-22'))
      .toEqual(t('2026-11-23', '2026-11-27')));
  it('treats an empty end as before start', () =>
    expect(bulkStartDatePatch(t('', ''), '2026-11-18'))
      .toEqual(t('2026-11-18', '2026-11-19')));
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test` → FAIL, module `@/lib/bulk-edit` missing.

- [ ] **Step 3: Implement `bulkStartDatePatch` in `src/lib/bulk-edit.ts`**

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test` → all PASS.

- [ ] **Step 5: Add `setTasksStartDate` to `timeline-store.ts`**

Add to the `TimelineStore` interface and implement with **one** `set(produce(...))`: build a `Set` of `taskIds`, walk every project's tasks, `Object.assign(task, bulkStartDatePatch(task, date))` for matches. No-op if `timeline` is null or no ids match.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && pnpm lint && pnpm test` → no errors.

```bash
git add src/lib/bulk-edit.ts src/lib/bulk-edit.test.ts src/store/timeline-store.ts
git commit -m "feat: add bulk start-date rule and setTasksStartDate store action"
```

---

### Task 3: Task selection store

**Files:**
- Create: `src/store/selection-store.ts`
- Create: `src/store/selection-store.test.ts`

**Interfaces:**
- Produces:
  - `useTaskSelectionStore` (plain zustand, **no** zundo) with state `selectedIds: ReadonlySet<string>` and actions `toggle(id: string): void`, `setMany(ids: string[], selected: boolean): void`, `clear(): void`. Each action replaces the Set (new instance) so selectors re-render.
  - `selectExistingIds(selected: ReadonlySet<string>, timeline: Pick<Timeline, 'projects'> | null): string[]` — ids that exist in `timeline`, in table order (project order, then task order).

- [ ] **Step 1: Write failing tests in `src/store/selection-store.test.ts`**

Reset with `useTaskSelectionStore.getState().clear()` in `beforeEach`.
- `toggle adds then removes`: `toggle('t_a')` → `selectedIds.has('t_a')` true; again → false.
- `setMany selects and deselects`: `setMany(['t_a','t_b'], true)` → size 2; `setMany(['t_a'], false)` → only `t_b`.
- `clear empties`: after `setMany(['t_a'], true)`, `clear()` → size 0.
- `selectExistingIds ignores missing ids`: timeline with projects `[{tasks:[{id:'t_1'},{id:'t_2'}]},{tasks:[{id:'t_3'}]}]` (cast minimal objects via `as unknown as Project`), selected `{'t_3','t_gone','t_1'}` → `['t_1','t_3']`.
- `selectExistingIds with null timeline` → `[]`.

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test` → FAIL, module missing.

- [ ] **Step 3: Implement `src/store/selection-store.ts`**

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/selection-store.ts src/store/selection-store.test.ts
git commit -m "feat: add transient task selection store"
```

---

### Task 4: Week date range on the editor header

**Files:**
- Modify: `src/features/timeline/timeline-table.tsx` (week header `<th>`, ~line 779–789)
- Modify: `src/features/io/export-pdf.ts` (`generatePresentHTML`, ~line 430–442)

**Interfaces:**
- Consumes: `getWeekRangeLabel(monday: Date)` (Task 1).

- [ ] **Step 1: Editor header**

In the week header cell keep `Wk {n}` as line 1 and add line 2 with `getWeekRangeLabel(firstColOfWeek.date)`, smaller and muted (`text-[9px] text-muted-foreground/70`, `whitespace-nowrap`), matching present mode's two-line layout. Store the Monday `Date` on each `weekGroups` entry when building it.

- [ ] **Step 2: Present/PDF**

Replace the `new Date(mon); fri.setDate(...)` block with `rangeLabel: getWeekRangeLabel(col.date)`.

- [ ] **Step 3: Check in the browser**

`pnpm dev`: editor header shows e.g. `Wk 1` / `30 Nov - 4 Dec 2026` for every week, fits within the 5-day width, readable in light and dark theme, sticky header still works while scrolling. Present mode header still shows the same labels as before.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`.

```bash
git add src/features/timeline/timeline-table.tsx src/features/io/export-pdf.ts
git commit -m "feat: show week date range on editor header"
```

---

### Task 5: Row checkboxes

**Files:**
- Create (CLI): `src/components/ui/checkbox.tsx`
- Modify: `src/features/timeline/timeline-table.tsx` (`SortableProjectRow`, `SortableTaskRow`)

**Interfaces:**
- Consumes: `useTaskSelectionStore` (`selectedIds`, `toggle`, `setMany`) from Task 3.

- [ ] **Step 1: Add the shadcn Checkbox**

Run: `pnpm dlx shadcn@latest add checkbox`. Expected: creates `src/components/ui/checkbox.tsx` on `@base-ui/react` with no new dependency in `package.json`. If it tries to add a dependency, stop and report.

- [ ] **Step 2: Task row checkbox**

In `SortableTaskRow`'s "Project + Task" cell, place a `Checkbox` absolutely in the left gutter (the `pl-8` area, left of the connector line), `aria-label={\`Select task ${task.name}\`}`, checked from `useTaskSelectionStore((s) => s.selectedIds.has(task.id))` (boolean selector so only the toggled row re-renders), `onCheckedChange` → `toggle(task.id)`. Frozen column offsets stay unchanged. Checkbox clicks must not start a dnd-kit drag.

- [ ] **Step 3: Project row checkbox**

In `SortableProjectRow`'s "Project + Task" cell, before the chevron: `checked` when the project has ≥ 1 task and all are selected; `indeterminate` when some are; `disabled` when it has no tasks. Click → `setMany(taskIds, !allSelected)`. `aria-label={\`Select all tasks in ${project.name}\`}`. Derive with a selector returning a primitive (e.g. selected count for this project's `taskIds`).

- [ ] **Step 4: Check in the browser**

Tick tasks across two projects; project checkbox shows indeterminate/checked correctly; collapsing a project keeps its selection; row drag-reorder still works; freeze-columns toggle still aligns.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`.

```bash
git add src/components/ui/checkbox.tsx src/features/timeline/timeline-table.tsx
git commit -m "feat: add task selection checkboxes to timeline rows"
```

---

### Task 6: Floating bulk action bar

**Files:**
- Create: `src/features/timeline/bulk-action-bar.tsx`
- Modify: `src/routes/timeline-editor.tsx`

**Interfaces:**
- Consumes: `useTaskSelectionStore`, `selectExistingIds` (Task 3); `setTasksStartDate` (Task 2); `DatePicker` from `@/components/ui/date-picker`.
- Produces: `export function BulkActionBar(): JSX.Element | null`.

- [ ] **Step 1: `BulkActionBar`**

`ids = selectExistingIds(selectedIds, timeline)`; render nothing when `ids.length === 0`. Otherwise a bar fixed bottom-centre above the footer (`fixed bottom-10 left-1/2 -translate-x-1/2 z-40`, card styling, `data-pdf-hide`) containing:
`{n} task(s) selected` · `DatePicker` with `value=""`, `placeholder="Start date"`, `onChange={(d) => setTasksStartDate(ids, d)}` · ghost button `Clear` with an `X` icon → `clear()`.
Selection is **not** cleared after applying.

- [ ] **Step 2: Mount and lifecycle in `timeline-editor.tsx`**

Render `<BulkActionBar />` after `<TimelineTable />`. Add `useEffect(() => () => useTaskSelectionStore.getState().clear(), [id])` so selection resets when leaving or switching timelines.

- [ ] **Step 3: Esc clears selection**

In the existing `handleKeyDown`, on `e.key === 'Escape'` call `clear()` **unless** `e.defaultPrevented`, or `document.activeElement` is an `input`/`textarea`/`[contenteditable="true"]`, or an open popover exists (`document.querySelector('[data-slot="popover-content"][data-open]')`).

- [ ] **Step 4: End-to-end check in the browser**

`pnpm dev`, then:
1. Select 3 tasks in 2 projects → bar shows "3 tasks selected".
2. Pick a Wednesday → all 3 start that day; a task whose end was earlier now ends Thursday; a task with a later end keeps it.
3. Pick a Saturday → tasks start the following Monday.
4. Cmd/Ctrl+Z once → all 3 tasks' dates return to before step 3 in one step.
5. Open the bar's DatePicker, press Esc → picker closes, selection stays. Focus a task-name input, press Esc → selection stays. Click empty area, press Esc → bar disappears.
6. Select a task, delete it → bar count drops; select only that one and delete → bar hides.
7. In direct-edit (file) mode, apply works and nothing writes until Save.
8. Export PDF / Present → no bar or checkboxes in the output.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit && pnpm lint && pnpm test && pnpm build` → all succeed.

```bash
git add src/features/timeline/bulk-action-bar.tsx src/routes/timeline-editor.tsx
git commit -m "feat: add floating bulk start-date action bar"
```
