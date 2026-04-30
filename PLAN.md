# Project Timeline — Development Plan

> Local-first project timeline / Gantt application. Single user, browser-only, no backend (v1).
> Design reference: `True_x_AF.xlsx` sheet `True-4`.

---

## 1. Overview

แอปจัดการ project timeline แบบ Gantt chart — เปิดได้บน browser ใช้งานได้แม้ไม่มี internet ทุก timeline เก็บใน IndexedDB ของเครื่องเอง

**User flow:**

```
[Dashboard] ──► เลือก timeline / สร้างใหม่ ──► [Timeline Editor]
     ▲                                                │
     └────────────── back to dashboard ◄──────────────┘
```

**Goals:**
- จัดการได้หลาย timeline ในแอปเดียว
- ใช้งานเหมือน Excel ได้คล่อง (click เพื่อแก้ไข, keyboard navigation)
- Save/Load JSON สำหรับ backup, share กันระหว่างทีม
- Export PDF ส่งให้ stakeholder
- Dark/Light mode, English UI

**Non-goals (v1):**
- Multi-user / collaboration
- Cloud sync / authentication
- Real-time updates
- Mobile-first (responsive ก็พอ)

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 8+** | เร็ว, HMR ดี, config น้อย |
| Framework | **React 19+** | requirement |
| Language | **TypeScript 6+** | requirement, type safety สำหรับ data model ที่ซับซ้อน |
| Styling | **Tailwind v4** | shadcn ใช้ tailwind, utility-first |
| UI Components | **shadcn/ui** (New York style) | requirement, copy-paste ownership ปรับเองได้ |
| Icons | **lucide-react** | default ของ shadcn |
| Routing | **React Router v6** | de-facto standard |
| State | **Zustand** | เบาที่สุด, no boilerplate, fits editor pattern ดี |
| Storage | **Dexie 4** (IndexedDB wrapper) | requirement, raw IDB API ปวดหัวมาก |
| Dates | **date-fns** | tree-shakable, immutable, TS-friendly |
| Theme | **next-themes** | ใช้ได้ดีแม้ไม่ใช่ Next |
| PDF | **jsPDF + html2canvas** | control เต็มที่, ใช้กันมานาน |
| Drag-and-drop | **@dnd-kit/core + @dnd-kit/sortable** | a11y ดีที่สุดใน React |
| Undo/Redo | **zundo** (Zustand middleware) | เล็ก, integrate กับ Zustand เป็นเนื้อเดียว |
| Form/Validation | **react-hook-form + zod** | ใช้แค่ตอน import JSON validation |

**สิ่งที่ตัดทิ้ง:**
- Redux / Redux Toolkit — overkill สำหรับ local-first single-user
- React Context อย่างเดียว — re-render ทั้ง tree เมื่อ state เปลี่ยน, แย่กับ Gantt ที่มีหลายร้อย cell
- localStorage — ขนาดจำกัด ~5MB, sync API block UI
- html2pdf.js — wrap jsPDF + html2canvas อยู่แล้ว ใช้ตรงๆ ดีกว่า control ได้มากกว่า

---

## 3. Routes & User Flow

```
/                        Dashboard — list ของ timeline ทั้งหมด
/timeline/:id            Timeline editor (Gantt + table)
/timeline/:id/settings   Timeline settings (rename, delete, export)  ← optional, ใส่เป็น modal ก็ได้
*                        404 → redirect home
```

**Dashboard:**
- Header: app logo, theme toggle, "+ New Timeline" button
- Search / filter bar
- Grid of timeline cards (title, customer, start date, project/task counts, last updated, mini progress bar)
- Empty state สำหรับ first-time user
- Card actions (3-dot menu): Open, Rename, Duplicate, Export JSON, Delete

**Timeline Editor:**
- Top header: ← Back, editable title, customer, start date, span (weeks), save status
- Toolbar: + Project, ↓ Today, ⬇ Save JSON, ⬆ Load JSON, ⎙ Export PDF
- Main: Gantt table (sticky headers + sticky left columns)
- Bottom: hint bar (keyboard shortcuts)

---

## 4. Data Model

### 4.1 TypeScript types

```ts
// lib/types.ts

export type Status = 'Not Started' | 'In Progress' | 'Done' | 'Blocked' | 'On Hold';

export type Priority = 'HIGHEST' | 'HIGH' | 'MED' | 'LOW' | 'LOWEST' | null;

export interface Task {
  id: string;            // 't_xxx'
  name: string;
  status: Status;
  priority: Priority;
  owner: string;
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  deliverable: string;
  percentComplete: number; // 0–100
}

export interface Project {
  id: string;            // 'p_xxx'
  name: string;
  status: Status;
  deliverable: string;
  expanded: boolean;
  tasks: Task[];
}

export interface TimelineMeta {
  id: string;            // 'tl_xxx' (uuid)
  title: string;
  customer: string;
  startDate: string;     // YYYY-MM-DD (anchor for Gantt grid)
  weeks: number;         // 1–52
  note: string;
  createdAt: number;     // epoch ms
  updatedAt: number;
  // derived (cached for fast list rendering)
  projectCount: number;
  taskCount: number;
}

export interface TimelineData {
  id: string;            // FK to TimelineMeta.id
  projects: Project[];
  holidays: string[];    // YYYY-MM-DD list — non-working days within timeline range
}

// "Hydrated" timeline (meta + data together) — used in editor
export interface Timeline extends TimelineMeta {
  projects: Project[];
}

// JSON export envelope
export interface TimelineExport {
  $schema: 'project-timeline/v1';
  exportedAt: string;    // ISO string
  timeline: Timeline;
}
```

### 4.2 IndexedDB schema (Dexie)

แยก meta กับ data เพื่อให้ dashboard list query เร็ว ไม่ต้องโหลดทั้ง projects array

```ts
// lib/db/schema.ts
import Dexie, { Table } from 'dexie';
import type { TimelineMeta, TimelineData } from '@/lib/types';

export class TimelineDB extends Dexie {
  timelineMeta!: Table<TimelineMeta, string>;  // PK: id
  timelineData!: Table<TimelineData, string>;  // PK: id

  constructor() {
    super('project-timeline-db');
    this.version(1).stores({
      timelineMeta: 'id, updatedAt, title, customer',
      timelineData: 'id',
    });
  }
}

export const db = new TimelineDB();
```

Indexes ที่ตั้งไว้: `updatedAt` (sort by recent), `title` + `customer` (search). Future migrations เพิ่มที่ `version(2)` ได้

### 4.3 Repository / DAO

```ts
// lib/db/timelines.ts

export const timelineRepo = {
  async list(): Promise<TimelineMeta[]> {
    return db.timelineMeta.orderBy('updatedAt').reverse().toArray();
  },

  async get(id: string): Promise<Timeline | null> {
    const [meta, data] = await Promise.all([
      db.timelineMeta.get(id),
      db.timelineData.get(id),
    ]);
    if (!meta || !data) return null;
    return { ...meta, projects: data.projects };
  },

  async create(input: Partial<Timeline>): Promise<string> { /* ... */ },
  async update(id: string, patch: Partial<Timeline>): Promise<void> { /* ... */ },
  async delete(id: string): Promise<void> { /* ... */ },
  async duplicate(id: string): Promise<string> { /* ... */ },
};
```

ทุก write ต้อง update `updatedAt` และ recompute `projectCount` / `taskCount` ก่อน save เพื่อให้ dashboard ไม่ต้องคำนวณ

---

## 5. Folder Structure

```
src/
├── app.tsx                    # router setup
├── main.tsx                   # entry
├── routes/
│   ├── dashboard.tsx          # /  — list page
│   ├── timeline-editor.tsx    # /timeline/:id
│   └── not-found.tsx
├── features/
│   ├── dashboard/
│   │   ├── timeline-card.tsx
│   │   ├── timeline-grid.tsx
│   │   ├── new-timeline-dialog.tsx
│   │   └── empty-state.tsx
│   ├── timeline/
│   │   ├── editor-header.tsx
│   │   ├── toolbar.tsx
│   │   ├── timeline-table.tsx        # main table container
│   │   ├── date-header-row.tsx       # week + day headers
│   │   ├── project-row.tsx
│   │   ├── task-row.tsx
│   │   ├── add-task-row.tsx
│   │   ├── gantt-bar.tsx             # absolute-positioned bar
│   │   ├── status-picker.tsx         # shadcn Popover
│   │   ├── priority-picker.tsx
│   │   ├── date-cell.tsx             # uses shadcn DatePicker
│   │   └── progress-cell.tsx
│   └── io/
│       ├── export-json.ts
│       ├── import-json.ts
│       └── export-pdf.ts
├── components/
│   ├── ui/                    # shadcn components (button, dialog, popover, etc.)
│   ├── theme-toggle.tsx
│   └── confirm-dialog.tsx
├── store/
│   ├── timeline-store.ts      # Zustand store for active timeline
│   └── selectors.ts
├── lib/
│   ├── db/
│   │   ├── schema.ts
│   │   └── timelines.ts       # repository
│   ├── date-utils.ts          # working days, columns, holidays
│   ├── id.ts                  # nanoid wrapper
│   ├── types.ts
│   └── utils.ts               # cn() etc. (from shadcn init)
├── hooks/
│   ├── use-debounce.ts
│   ├── use-autosave.ts
│   └── use-timeline.ts        # loads timeline by :id, hydrates store
├── styles/
│   └── globals.css
└── tests/                     # vitest if we add
```

---

## 6. Implementation Phases

แต่ละ phase ปิดด้วย acceptance criteria ที่ชัดเจน ก่อนข้ามไป phase ถัดไป

### Phase 0 — Project Setup *(~0.5 day)*

- [ ] `npm create vite@latest` (React + TS template)
- [ ] Install deps: tailwind, dexie, zustand, react-router-dom, date-fns, lucide-react, next-themes, jspdf, html2canvas, nanoid
- [ ] `npx shadcn@latest init` (New York, neutral base color, CSS variables for theme)
- [ ] Add shadcn components: `button dialog popover dropdown-menu input label select tooltip card sheet alert-dialog` (เพิ่มตามต้องการในแต่ละ phase)
- [ ] ตั้ง path alias `@/*` ใน `vite.config.ts` และ `tsconfig.json`
- [ ] Setup ESLint + Prettier
- [ ] React Router skeleton: 2 routes (`/`, `/timeline/:id`)
- [ ] ThemeProvider wrap (next-themes) + ThemeToggle component

**✓ DoD:** dev server รัน, route ทั้ง 2 เปิดได้, theme toggle ใช้งานได้, shadcn `<Button>` แสดงผลถูกต้องทั้ง dark/light

### Phase 1 — Data Layer *(~1 day)*

- [ ] เขียน types ทั้งหมดใน `lib/types.ts`
- [ ] Setup Dexie schema (`schema.ts`)
- [ ] เขียน repository functions ครบ (list, get, create, update, delete, duplicate)
- [ ] Helper: `derivedCounts(projects)` คำนวณ projectCount/taskCount
- [ ] Seed function: `seedDemoData()` — สร้าง timeline จากข้อมูล True-4 อัตโนมัติเมื่อเปิดครั้งแรก (DB ว่าง) ✓ **confirmed**
- [ ] Vitest unit tests สำหรับ repo (ใช้ fake-indexeddb)

**✓ DoD:** สร้าง/อ่าน/แก้/ลบ timeline ได้ผ่าน repo, demo data มีให้ดูตอนเปิดครั้งแรก

### Phase 2 — Dashboard *(~1.5 days)*

- [ ] Layout: top bar (logo, theme toggle), main content
- [ ] `<TimelineGrid>` — แสดง card grid (responsive: 1/2/3 col)
- [ ] `<TimelineCard>` — title, customer, start date, project count, task count, last updated (relative: "2 hours ago"), mini progress bar
- [ ] Search bar — filter ตาม title หรือ customer (client-side)
- [ ] Sort dropdown: Recently updated / Created / Title (A→Z)
- [ ] `<EmptyState>` — แสดงเมื่อไม่มี timeline เลย
- [ ] `<NewTimelineDialog>` — input title, customer, start date, weeks (default 9) → create แล้ว navigate ไป editor
- [ ] Card 3-dot menu: Open / Rename (inline) / Duplicate / Export JSON / Delete (with confirm)
- [ ] Loading state, error state

**✓ DoD:** เปิด `/` เห็น dashboard, สร้าง timeline ใหม่ได้, ลบได้ (มี confirm), search ใช้งานได้, เปิด timeline ผ่าน card → navigate ไป `/timeline/:id`

### Phase 3 — Timeline Editor (Core) *(~4 days)*

- [ ] `useTimeline(id)` hook — โหลดจาก repo, hydrate Zustand store, handle 404
- [ ] Zustand store schema (wrap ด้วย `zundo` `temporal` middleware สำหรับ Undo/Redo):
  ```ts
  interface TimelineStore {
    timeline: Timeline | null;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    setMeta(patch: Partial<TimelineMeta>): void;
    addProject(): void;
    updateProject(id: string, patch: Partial<Project>): void;
    deleteProject(id: string): void;
    addTask(projectId: string): void;
    updateTask(projectId: string, taskId: string, patch: Partial<Task>): void;
    deleteTask(projectId: string, taskId: string): void;
    moveProject(fromIdx: number, toIdx: number): void;
    moveTask(projectId: string, fromIdx: number, toIdx: number): void;
    toggleHoliday(date: string): void;
  }
  // Wrap:
  // create(temporal((set, get) => ({...}), {
  //   limit: 50,
  //   partialize: (s) => ({ timeline: s.timeline })  // track only timeline data
  // }))
  ```
- [ ] **Undo / Redo:**
  - Toolbar buttons (↶ / ↷) — `disabled` state ตาม `pastStates.length` / `futureStates.length`
  - Keyboard binds: `Cmd/Ctrl + Z` undo, `Cmd/Ctrl + Shift + Z` redo
  - Undo stack ไม่เก็บ saveStatus หรือ UI flag (ผ่าน `partialize`)
- [ ] **Drag-to-reorder rows** ผ่าน `@dnd-kit/sortable`:
  - Drag handle (`<GripVertical>` icon) ที่ขอบซ้ายของแต่ละแถว — visible เมื่อ hover
  - Sortable context สำหรับ projects (top-level reorder)
  - Sortable context per project สำหรับ tasks (intra-project reorder)
  - Cross-project task drag: defer to Phase 8
  - DragOverlay สำหรับ ghost preview ขณะลาก
- [ ] `<EditorHeader>` — title (Input), customer, start date (shadcn DatePicker), weeks (Input), note, save status indicator, back button
- [ ] `<Toolbar>` — `+ Project`, `↶ Undo`, `↷ Redo`, `↓ Today`, `🎉 Holidays`, `⬇ Save JSON`, `⬆ Load JSON`, `⎙ Export PDF`
- [ ] `<TimelineTable>` ใช้ HTML `<table>` (semantic + sticky behaviour)
  - Sticky thead, sticky left columns ผ่าน `position: sticky`
  - Column widths แน่นอน (set width บน `<th>` แล้ว `<td>` follow)
- [ ] `<ProjectRow>` — แสดง project (no priority cell, computed start/end/days, expand/collapse, drag handle, delete on hover)
- [ ] `<TaskRow>` — แก้ไข inline: name, owner, deliverable (Input), startDate/endDate (shadcn DatePicker), priority (Popover), status (Popover), %complete (Input + bar), drag handle
- [ ] `<AddTaskRow>` — ปุ่ม "+ Add task" ใต้แต่ละ project
- [ ] Add Project button ที่ toolbar → push project ลง store

**✓ DoD:** เปิด timeline ใดก็ได้ → เห็นข้อมูล, แก้ไขได้ทุก field, เพิ่ม/ลบ project/task ได้, expand/collapse ได้, ลาก reorder project/task ได้, Undo/Redo ใช้งานได้ (ทั้งปุ่มและ keyboard), computed values ของ project (start, end, days) update เมื่อ task เปลี่ยน

### Phase 4 — Gantt Rendering + Holidays + Bar Drag *(~3 days)*

- [ ] `lib/date-utils.ts`:
  - `generateColumns(startDate, weeks): DateColumn[]` — Mon–Fri only, anchor to Monday of startDate's week
  - `workingDaysBetween(start, end, holidays): number` — skip ทั้ง weekend และ holiday
  - `isToday(date): boolean`
  - `isHoliday(date, holidays): boolean`
  - `colIndexFromDate(date, cols): number | null` — หา column index จาก date string
- [ ] `<DateHeaderRow>` — 2 rows: Week labels + Date labels (DD + day-of-week)
  - Today column highlight
  - Week dividers (border-left ทุกวันจันทร์)
  - **Holiday columns:** tinted background (yellow-ish ใน light, dimmed amber ใน dark)
- [ ] `<GanttBar>` — absolute-positioned div ใน `<td>` ของวันแรกที่ task เริ่ม
  - Width = `(span * 100%) - 4px` (span = จำนวน column ที่ครอบคลุม)
  - **สำคัญ:** `td.timeline-cell` ห้ามมี `overflow: hidden` มิฉะนั้น bar จะถูก clip
  - Project bar: outline + tinted background (height 14px) — **read-only ใน v1**
  - Task bar: solid color ตาม priority (height 18px), มี progress overlay
  - Tooltip on hover (shadcn Tooltip): "Task name (DD/MM → DD/MM, X working days)"
- [ ] **Bar drag / resize** (custom PointerEvent + snap-to-day):
  - Hit zones บน task bar:
    - ขอบซ้าย 6px → `cursor: ew-resize` → mode `resize-left`
    - ขอบขวา 6px → `cursor: ew-resize` → mode `resize-right`
    - ตรงกลาง → `cursor: grab` / active `grabbing` → mode `move`
  - On `pointerdown`:
    - `setPointerCapture` ที่ bar element
    - บันทึก: initial X, task's startCol/endCol, mode
    - แสดง dragging overlay (ghost bar กึ่งโปร่งใส)
  - On `pointermove`:
    - `cellDelta = Math.round((e.clientX - startX) / CELL_WIDTH)`
    - คำนวณ `newStartCol` / `newEndCol` ตาม mode:
      - **Move** — shift ทั้งคู่ด้วย delta เท่ากัน (รักษา duration)
      - **Resize-left** — newStartCol เปลี่ยน, endCol คงเดิม, ห้ามเกิน endCol (อย่างน้อย 1 วัน)
      - **Resize-right** — newEndCol เปลี่ยน, startCol คงเดิม, ห้ามก่อน startCol
    - Clamp: `0 ≤ col ≤ totalCols - 1` (block ลากออกนอก range)
    - Update bar's `left` / `width` แบบ realtime
    - แสดง floating label ใกล้เมาส์: `"YYYY-MM-DD → YYYY-MM-DD (N days)"`
  - On `pointerup`:
    - แปลง col → date: `cols[newCol].dateStr`
    - เรียก `updateTask(pid, tid, { startDate, endDate })`
    - zundo เก็บเป็น 1 undo entry (atomic)
  - Touch / pen รองรับโดย default ผ่าน PointerEvent
  - ขณะลาก: disable row hover effects, hide DnD row-reorder handle เพื่อไม่สับสน
- [ ] Today indicator: vertical red dashed line overlay ผ่าน column ของวันนี้
- [ ] **Holiday management UI** (`<HolidaysSheet>` — shadcn Sheet เปิดจาก toolbar):
  - List ของ holidays ปัจจุบัน (sortable by date) + ปุ่มลบทีละรายการ
  - shadcn `<Calendar>` (multiple-mode) สำหรับเลือกวันใหม่ — toggle add/remove
  - Quick preset button: "Add Thai public holidays {YEAR}" — hardcoded list ของแต่ละปี
  - Apply ปุ่มเรียก `toggleHoliday()` ใน store → trigger re-render Gantt
- [ ] Performance check: timeline ที่มี 100+ tasks ยัง smooth (60fps scroll + drag)

**✓ DoD:** Gantt grid แสดงผลถูกต้อง; ลาก task bar (กลาง) เพื่อย้ายทั้งช่วงได้, ลากขอบซ้าย/ขวาเพื่อ resize ได้ — snap วันต่อวัน; holiday columns เห็นชัดทั้ง dark/light, working days คำนวณรวม skip holiday; today line ใช้งาน; undo คืน drag กลับได้

### Phase 5 — Auto-save / Persistence *(~0.5 day)*

- [ ] `useAutosave` hook:
  - Subscribe ต่อ store changes
  - Debounce 300ms
  - Update DB ผ่าน repo
  - Set `saveStatus` ระหว่าง saving
- [ ] Optimistic UI: update store ก่อน, ค่อย persist
- [ ] Error handling: ถ้า save fail → toast notification + retry option
- [ ] `beforeunload` warning ถ้ายัง saving อยู่
- [ ] Save status indicator ใน header (Idle / Saving… / Saved at HH:mm / Error)

**✓ DoD:** แก้ไขใดๆ → save อัตโนมัติภายใน 300ms, refresh แล้วข้อมูลยังอยู่, save status ถูกต้องเสมอ

### Phase 6 — Import / Export *(~1 day)*

- [ ] **Export JSON** — pack เป็น `TimelineExport` envelope, download via Blob URL, filename = `{title}_{date}.json`
- [ ] **Import JSON** — file picker → parse → validate ด้วย zod schema → ตัวเลือก:
  - "Replace current timeline" (overwrite ทั้ง record)
  - "Import as new timeline" (assign new ids ทั้งหมด)
- [ ] **Export PDF**:
  - Clone DOM ของ table area
  - ปรับ inline style: ปลด sticky, hide actions cells, hide add-task rows, force expand ทุก project
  - `html2canvas` → canvas (scale 2x)
  - `jsPDF` ขนาด custom = canvas dimensions in mm (เพื่อให้ pixel-perfect)
  - `addImage` แล้ว save
  - Loading overlay ระหว่าง export (อาจกินเวลา 2–5 วินาที)
- [ ] Error toasts สำหรับทุก operation

**✓ DoD:** Save JSON ดาวน์โหลดได้, Load JSON กลับมาได้ (ทั้ง replace และ new), Export PDF ได้ไฟล์ที่อ่านได้

### Phase 7 — Polish *(~1 day)*

- [ ] **Keyboard shortcuts** (เพิ่มเติมจาก Cmd+Z/Cmd+Shift+Z ที่ทำใน Phase 3):
  - `Cmd/Ctrl + S` → save JSON
  - `Esc` → close picker / cancel edit / cancel drag
  - `Tab` / `Shift+Tab` → ข้าม cell
  - `Arrow keys` → navigate cells (Excel-style, optional ถ้าเหลือเวลา)
- [ ] **A11y pass:**
  - Focus rings ทุก interactive element (shadcn ทำให้แล้วเป็นส่วนใหญ่)
  - aria-label สำหรับ icon buttons (drag handle, undo, redo, delete, expand)
  - aria-expanded สำหรับ project rows
  - role="grid" + roving tabindex (ถ้ามีเวลา)
  - DnD: ทดสอบ keyboard nav ของ @dnd-kit ใช้ได้
- [ ] **Empty states & error boundaries:**
  - Timeline ว่าง (ไม่มี project) → แสดง CTA
  - 404 timeline → "Timeline not found" + back to dashboard
  - Crash → ErrorBoundary fallback
- [ ] **Dark mode QA:** ตรวจ contrast ทุก state, focus ring, hover, selected, Gantt bars (สีจัดบน dark background ต้อง dim), holiday tint, today line

**✓ DoD:** A11y audit ผ่าน (axe), keyboard-only ใช้ได้ครบ, dark/light ดูดีทั้งสอง

### Phase 8 — Optional / Future *(timeboxed)*

- Task dependencies (`predecessors: string[]` + arrow lines)
- Cross-project task drag (DnD ระหว่าง project)
- **Drag project bar** → shift child tasks ทั้งหมดเป็นกลุ่ม
- **Magnetic snap** → snap bar edges กับ start/end ของ task อื่น (visual guide line)
- Filter view (by owner, status, priority)
- Multi-select rows + bulk actions
- BroadcastChannel sync (multi-tab same browser)
- PWA + offline service worker
- Per-cell color customization
- Print stylesheet (Cmd+P → printable view)
- Timeline templates (save/load as template)
- Excel/CSV export
- Auto-fetch Thai public holidays via API (เช่น Nager.Date)

---

## 7. Key Technical Decisions

### 7.1 Why Zustand over Context/Redux

- Editor store มี action บ่อย (every keystroke) → Context จะ re-render ทั้ง subtree
- Redux มี boilerplate มาก, ไม่ได้ประโยชน์จาก devtools มากเท่ากับ pain
- Zustand: subscribe เฉพาะ slice ที่ใช้, ใช้ `useShallow` ป้องกัน re-render เกินจำเป็น

### 7.2 Dexie Schema Versioning

Plan ไว้แต่แรกว่าทุก breaking change ต้องเขียน migration:
```ts
this.version(2).stores({...}).upgrade(async tx => {
  await tx.table('timelineMeta').toCollection().modify(t => {
    t.newField = 'default';
  });
});
```
อย่า silently mutate schema — IndexedDB ไม่ลืม

### 7.3 Auto-save Strategy

- **Debounce 300ms** (ไม่ใช่ throttle) — รอจนผู้ใช้หยุดพิมพ์
- **Optimistic** — update store ทันที, persist ตามหลัง
- **Granular** — ถ้า save fail แค่ flag error, ไม่ revert state (ผู้ใช้ยังเห็นการแก้ของตัวเอง)
- **Last-write-wins** — single user single tab, ไม่ต้อง merge

### 7.4 PDF Strategy

ลอง 2 ทาง — เลือกที่ work ดีกว่า:
1. **Single-page custom-size PDF** — ดี เพราะไม่ตัด timeline ขาดกลาง, แต่ไฟล์อาจใหญ่
2. **Multi-page A3 landscape** — ขนาดมาตรฐาน, แต่ต้อง split ดีๆ ไม่ตัด bar กลาง

แนะนำเริ่มจาก (1) แล้ว fallback (2) เป็น option

### 7.5 Theme Implementation

ใช้ `next-themes` + Tailwind `dark:` variants. shadcn เซ็ตให้แล้วผ่าน CSS variables ใน `globals.css`:
```css
:root { --background: ...; --foreground: ...; }
.dark { --background: ...; --foreground: ...; }
```
ระวัง Gantt bar colors ต้อง override ใน dark mode (สีจัดบน dark background กลายเป็นแสบตา)

### 7.6 Performance

- Memoize date column generation (เปลี่ยนเฉพาะตอน startDate/weeks เปลี่ยน)
- `React.memo` สำหรับ `<TaskRow>` — props comparison แค่ task object reference
- Update task → produce ใหม่เฉพาะ task นั้น (ใช้ Immer ผ่าน Zustand middleware)
- ถ้า > 200 tasks: พิจารณา virtualization (`@tanstack/react-virtual`) — สำหรับ table ที่มี sticky cols ต้องระวังเรื่อง offset

### 7.7 Bar Drag — Custom PointerEvent vs Library

เลือก **custom PointerEvent** (ไม่ใช้ react-rnd / interactjs) เพราะ:

- Gantt bar ไม่ใช่ standalone element — มันอยู่ภายใน table cell ที่ขนาดคงที่ + scrollable container ทำให้ library ทั่วไปคำนวณ position ผิด
- Snap-to-day = แค่ `Math.round(dx / cellWidth)` — ไม่ต้องการ feature lib อื่นๆ
- PointerEvent native = touch/pen รองรับฟรี
- Bundle size: 0 byte vs react-rnd ~10KB / interactjs ~50KB
- ใช้ logic เพียง ~80–100 บรรทัด encapsulate ใน custom hook `useBarDrag(taskId, mode)`

ถ้าทำแล้วเจอ edge case เยอะ (e.g. cross-row drag, magnetic snap to other bars) → เปลี่ยนเป็น **interactjs** ได้ใน Phase 8

---

## 8. JSON Format (v1 contract)

```json
{
  "$schema": "project-timeline/v1",
  "exportedAt": "2026-04-28T10:00:00.000Z",
  "timeline": {
    "id": "tl_abc123",
    "title": "Gamification — True x AF",
    "customer": "True Privileges",
    "startDate": "2026-04-27",
    "weeks": 9,
    "note": "Wireframe",
    "createdAt": 1714291200000,
    "updatedAt": 1714291200000,
    "projectCount": 5,
    "taskCount": 20,
    "projects": [
      {
        "id": "p_xxx",
        "name": "System Analysis",
        "status": "Not Started",
        "deliverable": "Wireframe",
        "expanded": true,
        "tasks": [
          {
            "id": "t_xxx",
            "name": "System Analysis + PoC",
            "status": "In Progress",
            "priority": "HIGHEST",
            "owner": "CODESMASH",
            "startDate": "2026-04-28",
            "endDate": "2026-04-29",
            "deliverable": "",
            "percentComplete": 0
          }
        ]
      }
    ]
  }
}
```

Validate ด้วย zod schema ตอน import — reject ถ้า `$schema` mismatch

---

## 9. Out of Scope (v1)

- Backend / cloud sync / multi-user
- Authentication
- Real-time collab
- Notifications / reminders
- Integration กับ external tools (Jira, Asana, Google Calendar)
- AI features (generate plan, suggest dates)
- Mobile app
- i18n (English only ตาม requirement)
- Analytics

---

## 10. Decisions Confirmed

| # | Question | Decision | Phase |
|---|---|---|---|
| 1 | Demo data on first open | ✓ Seed True-4 data | 1 |
| 2 | Date picker UI | ✓ shadcn DatePicker (popover calendar) | 3 |
| 3 | Drag-to-reorder rows | ✓ Include in v1 | 3 |
| 4 | Holiday markers | ✓ Include in v1 | 4 |
| 5 | Undo/Redo | ✓ Include in v1 (zundo) | 3 |
| 6 | Keyboard shortcuts (general) | Phase 7 polish | 7 |
| 7 | PDF orientation | Auto: single-page custom-size, fallback A3 landscape | 6 |
| 8 | Drag bar เพื่อ move/resize ช่วงเวลา | ✓ Include in v1 (custom PointerEvent + snap-to-day) | 4 |

---

## 11. Estimated Total

| Phase | Effort |
|---|---|
| 0. Setup | 0.5 day |
| 1. Data Layer | 1 day |
| 2. Dashboard | 1.5 days |
| 3. Editor Core (+ DnD + Undo/Redo) | 4 days |
| 4. Gantt + Holidays + Bar Drag | 3 days |
| 5. Auto-save | 0.5 day |
| 6. Import/Export | 1 day |
| 7. Polish | 1 day |
| **v1 Total** | **~12.5 days** |
| 8. Optional | +3–5 days |

(สำหรับ 1 dev solo ทำงานเต็มเวลา)

---

## 12. Suggested Start

ตอนนี้ decisions ครบแล้ว ขั้นต่อไป:

1. **Phase 0** — Vite + TS + Tailwind + shadcn init (0.5 day)
2. **Phase 1** — types, Dexie schema, repo, seed True-4 (1 day)
3. ก่อนข้าม **Phase 3** → ทำ rough wireframe ของ editor บนกระดาษก่อน เห็นภาพ layout ชัดๆ โดยเฉพาะตรง drag handle, holiday cell, undo/redo button placement
4. Commit ทุก phase ปิด, tag เป็น `v0.{phase}` — rollback ง่ายถ้าพลาด
5. หลัง Phase 4 → ลอง use case จริง (สร้าง timeline 2-3 อัน, ใช้งานจริง 1 สัปดาห์) ก่อนปิด Phase 7