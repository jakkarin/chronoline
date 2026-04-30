# AGENTS.md — Chronoline

> Guidance for AI agents (Codex, Cascade, Copilot, etc.) working on this codebase.

---

## Project Overview

**Chronoline** is a local-first, browser-only Gantt / project timeline app.  
No backend. No auth. All data lives in IndexedDB via [Dexie](https://dexie.org/).

**Stack:**
- **React 19** + **TypeScript 6** (Vite 8)
- **Tailwind v4** + **shadcn/ui** (New York style)
- **Zustand 5** (state) + **zundo** (undo/redo middleware)
- **Dexie 4** (IndexedDB)
- **React Router v7**
- **date-fns 4**, **lucide-react**, **next-themes**, **jsPDF + html2canvas**, **@dnd-kit**

---

## Repo Layout

```
src/
├── App.tsx                   # Router setup
├── main.tsx                  # Entry point
├── routes/                   # Page-level components
│   ├── dashboard.tsx         # / — timeline list
│   ├── timeline-editor.tsx   # /timeline/:id
│   └── not-found.tsx
├── features/
│   ├── dashboard/            # TimelineCard, TimelineGrid, NewTimelineDialog, EmptyState
│   ├── timeline/             # EditorHeader, Toolbar, TimelineTable, GanttBar, rows, pickers
│   └── io/                   # export-json, import-json, export-pdf
├── components/
│   ├── ui/                   # shadcn components (do not hand-edit — re-run shadcn CLI)
│   └── ...                   # theme-toggle, confirm-dialog, etc.
├── store/
│   └── timeline-store.ts     # Zustand store for the active timeline
├── lib/
│   ├── db/                   # Dexie schema + repository (schema.ts, timelines.ts, seed.ts)
│   ├── date-utils.ts         # Column generation, working-days math, holiday helpers
│   ├── types.ts              # All shared TypeScript types
│   ├── id.ts                 # nanoid wrapper
│   └── utils.ts              # cn() from shadcn
├── hooks/                    # use-debounce, use-autosave, use-timeline
└── types/                    # Additional ambient/global types
```

---

## Core Data Model

Defined in `src/lib/types.ts`:

| Type | Key fields |
|---|---|
| `Task` | `id`, `name`, `status`, `priority`, `owner`, `startDate`, `endDate`, `percentComplete` |
| `Project` | `id`, `name`, `status`, `tasks[]`, `expanded` |
| `TimelineMeta` | `id`, `title`, `customer`, `startDate`, `weeks`, `projectCount`, `taskCount`, `updatedAt` |
| `TimelineData` | `id`, `projects[]`, `holidays[]` |
| `Timeline` | `TimelineMeta` + `projects[]` (hydrated, used in editor) |

IndexedDB uses **two tables** (`timelineMeta` and `timelineData`) so the dashboard can list timelines without loading all projects.

---

## State Management

`src/store/timeline-store.ts` holds the **active timeline** in Zustand, wrapped with `zundo` for undo/redo (limit 50, only `timeline` is tracked via `partialize`).

Key actions: `setMeta`, `addProject`, `updateProject`, `deleteProject`, `addTask`, `updateTask`, `deleteTask`, `moveProject`, `moveTask`, `toggleHoliday`.

**Do not** store `saveStatus` or UI flags in the undo stack.

---

## Development Rules

1. **No backend.** All persistence goes through `src/lib/db/timelines.ts` (Dexie repo). Never add server calls.
2. **Every write** to the DB must update `updatedAt` and recompute `projectCount` / `taskCount`.
3. **Auto-save** is debounced 300 ms, optimistic (store updates first, DB follows). See `src/hooks/use-autosave.ts`.
4. **shadcn components** in `src/components/ui/` are managed by the shadcn CLI — do not manually edit them unless absolutely necessary; prefer adding new components via `pnpm dlx shadcn@latest add <component>`.
5. **Imports** — always use the `@/` alias (maps to `src/`). Relative imports are allowed within the same feature folder.
6. **Date handling** — use `date-fns` only. No `moment`, no raw `new Date()` arithmetic. Dates are stored as `YYYY-MM-DD` strings.
7. **IDs** — use `src/lib/id.ts` (nanoid wrapper). Prefix convention: `tl_` timelines, `p_` projects, `t_` tasks.
8. **Styling** — Tailwind utility classes only; avoid inline styles except for dynamic values (e.g. Gantt bar widths). Dark mode via `dark:` variants and CSS variables defined in `src/index.css`.
9. **Do not add new dependencies** without noting the reason. Check `package.json` first — the required library may already be present.
10. **TypeScript** — strict mode is on. Do not use `any` or `// @ts-ignore` without a comment explaining why.

---

## Commands

```bash
# Start dev server
pnpm dev

# Type-check
pnpm tsc --noEmit

# Lint
pnpm lint

# Build
pnpm build
```

---

## Key Implementation Notes

### Gantt Grid
- `src/lib/date-utils.ts` → `generateColumns(startDate, weeks)` produces Mon–Fri columns only, anchored to the Monday of `startDate`'s week.
- Gantt bars use **absolute positioning** inside their start-date `<td>`. The cell must **not** have `overflow: hidden`.
- Bar drag/resize uses raw **PointerEvent** (`setPointerCapture`), not a library. Logic lives in `src/features/timeline/` — look for `useBarDrag` or similar hook.

### Undo / Redo
- Triggered via toolbar buttons **and** `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z`.
- Access past/future states via `useTemporalStore` (zundo).

### Import / Export
- JSON envelope schema: `{ $schema: "project-timeline/v1", exportedAt, timeline }`.
- Validated with **zod** on import. Reject if `$schema` mismatches.
- PDF export clones the DOM, strips sticky styles, then uses `html2canvas` → `jsPDF`.

### Routing
- `/` → Dashboard
- `/timeline/:id` → Timeline Editor
- Anything else → 404 → redirect `/`

---

## Out of Scope (v1)

- Multi-user / cloud sync / authentication
- Real-time collaboration
- Mobile-first layout
- i18n (English only)
- AI-generated plans
