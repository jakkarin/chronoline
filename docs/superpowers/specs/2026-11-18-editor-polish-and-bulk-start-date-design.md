# Editor polish + bulk start-date edit — design

Source: [jakkarin/chronoline#7](https://github.com/jakkarin/chronoline/issues/7), items 4, 6 and 5.
Items 1–3 (task dependencies) are a separate project and are **not** covered here.

## Intent

Three small editor improvements requested in the issue:

- **A1** Stop accidental text selection and double-tap zoom while working in the editor (mostly touch / trackpad use).
- **A2** Show which month each week falls in on the editor's table header, the way presentation mode already does.
- **C** Let the user select several tasks and set one new start date on all of them at once.

## Counting rule (shared decision)

All day counting in this work uses **Mon–Fri**: skip Saturday and Sunday, do **not** skip holidays.
This matches how the grid already works (Mon–Fri columns only) and how bar dragging already moves tasks.
No user-facing setting for counting mode.

## Approaches

| Part | Options considered | Picked | Why |
|---|---|---|---|
| A1 | (a) CSS: `user-select: none` + `touch-action: manipulation`; (b) lock viewport with `user-scalable=no` | (a) | (b) also kills pinch-zoom (accessibility) and iOS ignores it anyway |
| A2 | (1) Add the week's date range under "Wk N" in the existing week header cell, like present mode; (2) a new month row above the week row | (1) | The issue asks for it "like the presentation mode" |
| C | (1) Floating action bar shown while tasks are selected; (2) a "Set start date" button in the toolbar | (1) | Selection state is visible, toolbar stays uncluttered, and other bulk actions (status, owner…) can be added later |

Selection UI for C: **checkboxes** on rows (picked by user).

## Design

### A1 — Gestures (`src/index.css`)

- In `@layer base`, on `body`: `user-select: none` (plus `-webkit-user-select`) and `touch-action: manipulation`.
- Re-enable selection on `input`, `textarea`, `[contenteditable="true"]` so editing still works.
- Do not touch the viewport meta tag. Pinch-zoom keeps working.
- `gantt-bar.tsx` already sets `touch-action: none` on bars; that still wins inside bars.

### A2 — Month on editor week header (`timeline-table.tsx`)

- Week header cell becomes two lines, matching present mode:
  ```
  Wk 1
  1 Dec - 5 Dec 2026
  ```
- Extract a shared helper in `src/lib/date-utils.ts`, e.g. `getWeekRangeLabel(monday: Date): string` → `d MMM - d MMM yyyy`, using `addDays`.
- Use it in both `timeline-table.tsx` and `export-pdf.ts` (`generatePresentHTML`). This also removes the raw `new Date(mon); fri.setDate(...)` arithmetic there (AGENTS.md rule 6).
- Second line uses smaller, muted text (present mode uses 9px, muted). A 5-day week is 160px wide, enough for the label.

### C — Bulk start-date edit

**Selection state**
- Transient UI state, **not** in the zundo-tracked store (AGENTS.md: no transient UI in undo stack).
- Small separate zustand store (e.g. `src/store/selection-store.ts`) holding selected task IDs, with `toggle`, `setMany`, `clear`.
- Selection is cleared when the editor unmounts / a different timeline loads.
- IDs that no longer exist (task deleted, undo) are ignored: derive the effective selection by intersecting with current task IDs.

**Row checkboxes**
- Each task row gets a checkbox in the "Project + Task" cell, in the left gutter before the name. Putting it there leaves the frozen-column offsets (`left-27.5`, `left-49`, `left-66`) as they are.
- Each project row gets a checkbox: checked when all its tasks are selected, indeterminate when some are, and clicking toggles all tasks in that project.
- Selection may span projects.
- Use the shadcn Checkbox (base-ui, already a dependency) added via the CLI.

**Floating action bar**
- Fixed at the bottom-centre of the editor, visible while ≥ 1 task is selected:
  ```
  ┌─────────────────────────────────────────────┐
  │ 3 tasks selected  [Start date ▾]  [Clear ✕] │
  └─────────────────────────────────────────────┘
  ```
- "Start date" opens the existing `DatePicker`. Picking a date applies immediately.
- Selection stays after applying, so the user can adjust again. Clear button or `Esc` clears it. If a popover is open, `Esc` closes the popover first.
- Not rendered in PDF export / present capture.

**Store action** (`timeline-store.ts`)
- `setTasksStartDate(taskIds: string[], date: string)` in a single `set(produce(...))`, so it is **one undo step**.
- Rules:
  1. If `date` is Sat/Sun → snap to the following Monday.
  2. For each selected task: `startDate = date`.
  3. If the task's `endDate < date` → `endDate = next weekday after date` (Fri → Mon).
  4. If `endDate >= date` → keep `endDate` (duration changes).
- Add `date-utils` helpers for weekend snap / next weekday (reusable by the dependency work later).
- Project/task counts don't change; `updatedAt` is handled by the existing save path (AGENTS.md rule 2).

## Non-goals

- Task dependencies, insert-and-push, and the "move dependents?" modal (issue items 1–3, separate design).
- Holiday-aware counting or a counting-mode setting.
- Bulk end date, shift-by-offset, or other bulk fields (status, owner…).
- Fixing how bars render when a date falls on a weekend or outside the grid range (existing behaviour; tracked separately).

## Left to the builder

- Exact styling of the checkbox gutter and floating bar (follow existing Tailwind/shadcn look).
- Whether the floating bar shows a short success toast after applying.
- No test runner exists in the repo; verify with `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, and a manual check in the browser.
