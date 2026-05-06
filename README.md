# Chronoline

Chronoline is a local-first, browser-only Gantt and project timeline app. It runs entirely on the client, stores data in IndexedDB via Dexie, and can be installed as a PWA.

No backend. No auth. Timeline data stays in the browser.

## Features

- Dashboard for creating, searching, sorting, and opening timelines.
- Timeline editor with groups, tasks, working-day columns, inline editing, and frozen left columns.
- Drag and resize Gantt bars directly in the grid.
- Reorder groups and tasks with a dedicated reorder flow.
- Undo and redo with optimistic autosave.
- Named versions with restore and optional backup-before-restore.
- JSON import/export for moving timelines in and out of the app.
- Presentation and export flows for shareable timeline captures.
- Light and dark theme support.

## Tech Stack

- React 19
- TypeScript 6
- Vite 8
- Tailwind CSS v4
- shadcn/ui
- Zustand + zundo + Immer
- Dexie
- React Router 7
- date-fns
- zod
- @dnd-kit
- vite-plugin-pwa

## Getting Started

Requirements:

- Node.js
- npm

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run lint:

```bash
npm run lint
```

Run type-checking:

```bash
npx tsc --noEmit
```

Create a production build:

```bash
npm run build
```

## How It Works

- Timeline metadata, full timeline data, and saved versions are stored in separate IndexedDB tables.
- Autosave is debounced and optimistic: the editor updates first, then persists to Dexie.
- On first launch, the app seeds a sample timeline if the local database is empty.
- JSON import can either replace the current timeline or create a new one.
- Saved versions snapshot projects and holidays so a timeline can be restored later.

## Project Structure

```text
src/
  components/    Shared UI and app-level components
  features/      Dashboard, timeline editor, and IO flows
  hooks/         Timeline loading and autosave hooks
  lib/           Data model, date utilities, Dexie repositories, helpers
  routes/        Dashboard, timeline editor, and not-found routes
  store/         Zustand timeline store with undo/redo
public/
  icons/         App icons and PWA assets
```

## Notes

- Dates are stored as `YYYY-MM-DD` strings.
- Working-day columns are Monday through Friday only.
- The app is intentionally local-first; there is no server sync in this version.

## Open Source

- Project license: MIT. See `LICENSE`.
- Contribution guide: `CONTRIBUTING.md`.
- Community expectations: `CODE_OF_CONDUCT.md`.
- Security reporting: `SECURITY.md`.
- Third-party notices: `THIRD-PARTY-NOTICES.md`.

