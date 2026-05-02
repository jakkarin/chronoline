# AGENTS.md — Chronoline

> Guidance for AI agents (Codex, Cascade, Copilot, etc.) working on this codebase.

---

## Project Overview

**Chronoline** is a local-first, browser-only Gantt / project timeline app and installable PWA.  
No backend. No auth. Timeline data and saved versions live in IndexedDB via [Dexie](https://dexie.org/).

**Stack:**
- **React 19** + **TypeScript 6** (**Vite 8**)
- **Tailwind v4** + **shadcn/ui** + **Geist Variable**
- **Zustand 5** + **zundo** + **Immer**
- **Dexie 4** (IndexedDB)
- **React Router 7**
- **date-fns 4**, **zod 4**, **lucide-react**, **next-themes**
- **@dnd-kit** for reordering flows
- **jsPDF + html2canvas** for export / presentation capture
- **vite-plugin-pwa** for manifest and service worker generation

---

## Repo Layout

```
src/
├── App.tsx                   # Router + theme provider + global toaster/modal mounts
├── main.tsx                  # Entry point
├── routes/
│   ├── dashboard.tsx         # / — timeline list
│   ├── timeline-editor.tsx   # /timeline/:id
│   └── not-found.tsx         # 404 screen with dashboard return action
├── features/
│   ├── dashboard/            # Empty state, timeline cards, new timeline dialog
│   ├── timeline/             # Editor header, toolbar, table, gantt bar, holidays, reorder, present mode, versions
│   └── io/                   # JSON import/export and PDF export
├── components/
│   ├── ui/                   # shadcn components (do not hand-edit unless necessary)
│   └── ...                   # confirm-dialog, deferred-input, terms-privacy-modal, theme-toggle
├── hooks/                    # use-autosave, use-debounce, use-timeline
├── lib/
│   ├── db/                   # Dexie schema + repositories (schema.ts, timelines.ts, versions.ts, seed.ts)
│   ├── date-utils.ts         # Working-day math, column generation, holiday helpers
│   ├── id.ts                 # nanoid wrapper with prefixed IDs
│   ├── task-colors.ts        # Task color presets and bar color helpers
│   ├── types.ts              # Shared domain types
│   └── utils.ts              # cn() and shared utilities
└── types/                    # Ambient/vendor typings (e.g. snapdom)

public/
└── icons/                    # PWA, favicon, and app icon assets
```

---

## Core Data Model

Defined in `src/lib/types.ts`:

| Type | Key fields |
|---|---|
| `Task` | `id`, `name`, `status`, `priority`, `color`, `owner`, `startDate`, `endDate`, `deliverable`, `percentComplete` |
| `Project` | `id`, `name`, `status`, `deliverable`, `tasks[]`, `expanded` |
| `TimelineMeta` | `id`, `title`, `customer`, `startDate`, `weeks`, `note`, `createdAt`, `updatedAt`, `projectCount`, `taskCount` |
| `TimelineData` | `id`, `projects[]`, `holidays[]` |
| `Timeline` | `TimelineMeta` + `projects[]` + `holidays[]` |
| `TimelineVersion` | `id`, `timelineId`, `name`, `note`, `createdAt`, `schemaVersion`, `snapshot`, `stats` |

IndexedDB uses **three tables** (`timelineMeta`, `timelineData`, `timelineVersions`) so the dashboard can list lightweight records, the editor can load full timeline data, and the version history can restore saved snapshots.

---

## State Management

`src/store/timeline-store.ts` holds the **active timeline** plus `saveStatus` in Zustand, wrapped with `zundo` for undo/redo.

- Undo history is limited to 50 states.
- Only `timeline` is tracked via `partialize`; `saveStatus` is intentionally excluded.
- Key actions include `setTimeline`, `setMeta`, project/task CRUD, cross-project moves, `toggleHoliday`, `saveVersion`, and `restoreVersion`.
- Restoring a version reloads the timeline from Dexie and clears temporal undo history.

**Do not** store `saveStatus` or transient UI state in the undo stack.

---

## Development Rules

1. **No backend.** Timeline persistence goes through `src/lib/db/timelines.ts`; version snapshot flows go through `src/lib/db/versions.ts`. Never add server calls.
2. **Every timeline write** must keep `updatedAt`, `projectCount`, and `taskCount` correct. Restores and deletes are part of this rule.
3. **Auto-save** is debounced 300 ms and optimistic (store updates first, DB follows). See `src/hooks/use-autosave.ts`.
4. **shadcn components** in `src/components/ui/` are CLI-managed. Prefer generated updates over hand edits.
5. **Imports** — prefer the `@/` alias (maps to `src/`). Relative imports are fine within the same feature folder.
6. **Date handling** — use `date-fns` only. No `moment`, no raw `new Date()` arithmetic. Dates are stored as `YYYY-MM-DD` strings.
7. **IDs** — use `src/lib/id.ts` (nanoid wrapper). Prefixes in use: `tl_`, `p_`, `t_`, `v_`.
8. **Styling** — prefer Tailwind utility classes in app UI. Inline styles are acceptable for dynamic geometry and isolated export / presentation surfaces.
9. **PWA assets** — manifest/service worker generation is configured in `vite.config.ts`; app icons live in `public/icons/`. Keep filenames in sync.
10. **Do not add new dependencies** without noting the reason. Check `package.json` first — the needed library may already be present.
11. **TypeScript** — strict mode is on. Do not use `any` or `// @ts-ignore` without a concrete reason.

---

## Commands

```bash
# Start dev server
npm run dev

# Type-check (TS 6 currently needs deprecation opt-in)
npx tsc --noEmit --ignoreDeprecations 6.0

# Lint
npm run lint

# Build
npm run build
```

---

## Key Implementation Notes

### Gantt Grid
- `src/lib/date-utils.ts` → `generateColumns(startDate, weeks)` produces Mon-Fri columns only, anchored to the Monday of `startDate`'s week.
- Gantt bars use **absolute positioning** inside their start-date `<td>`. The cell must **not** clip overflow.
- Bar drag/resize in `src/features/timeline/gantt-bar.tsx` uses raw **PointerEvent** + `setPointerCapture`, not `@dnd-kit`.

### Reordering
- Timeline table and reorder dialog flows use **@dnd-kit**.
- If you add a `DndContext` inside table markup, render accessibility helpers outside the table to avoid invalid DOM nesting warnings.
- The reorder dialog is the safer fallback path when table-row dragging gets brittle.

### Undo / Redo
- Triggered via toolbar buttons **and** `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z`.
- Restoring a saved version clears temporal history after the fresh DB snapshot is loaded.

### Versions
- Saved versions live in `timelineVersions` and snapshot `projects` plus `holidays`.
- Restores can optionally create a backup version first.
- Schema compatibility is gated by `VERSION_SCHEMA_VERSION` in `src/lib/db/schema.ts`.

### Import / Export / Present
- JSON envelope schema: `{ $schema: "project-timeline/v1", exportedAt, timeline }`.
- Import is validated with **zod**; reject when the schema or timeline shape mismatches.
- PDF/presentation capture renders isolated HTML and runs `html2canvas` inside an iframe before export/copy flows hand the result to `jsPDF` or the clipboard.

### Routing
- `/` -> Dashboard
- `/timeline/:id` -> Timeline Editor
- Anything else -> 404 screen with a button back to `/`

---

## Out of Scope (v1)

- Multi-user / cloud sync / authentication
- Real-time collaboration
- Mobile-first layout
- i18n (English only)
- AI-generated plans
