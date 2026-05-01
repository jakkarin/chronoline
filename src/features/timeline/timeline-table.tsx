import React, { useMemo, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { generateColumns, workingDaysBetween, isToday, isHoliday, DAY_LABELS, colIndexFromDate } from '@/lib/date-utils';
import { useTimelineStore } from '@/store/timeline-store';
import { StatusPicker } from './status-picker';
import { PriorityPicker } from './priority-picker';
import { TaskColorPicker } from './task-color-picker';
import { GanttBar } from './gantt-bar';
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { Project, Task } from '@/lib/types';

// ─── Project Row ────────────────────────────────────────────────────────────

interface ProjectRowProps {
  project: Project;
  cols: ReturnType<typeof generateColumns>;
  holidays: string[];
  freeze: boolean;
  ownerSuggestions: string[];
}

function SortableProjectRow({ project, cols, holidays, freeze, ownerSuggestions }: ProjectRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateProject = useTimelineStore((s) => s.updateProject);
  const deleteProject = useTimelineStore((s) => s.deleteProject);
  const addTask = useTimelineStore((s) => s.addTask);
  const moveTask = useTimelineStore((s) => s.moveTask);

  const taskSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleTaskDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = project.tasks.findIndex((t) => t.id === active.id);
    const toIdx = project.tasks.findIndex((t) => t.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) moveTask(project.id, fromIdx, toIdx);
  }

  const pRange = useMemo(() => {
    const dates = project.tasks.flatMap((t) => [t.startDate, t.endDate]).filter(Boolean);
    if (!dates.length) return null;
    const sorted = [...dates].sort();
    return { start: sorted[0], end: sorted[sorted.length - 1] };
  }, [project.tasks]);

  const pStartCol = pRange ? (colIndexFromDate(pRange.start, cols) ?? 0) : -1;
  const pEndCol = pRange ? (colIndexFromDate(pRange.end, cols) ?? cols.length - 1) : -1;
  const pDays = pRange ? workingDaysBetween(pRange.start, pRange.end, holidays) : 0;

  const totalCols = 11 + cols.length;

  return (
    <tbody
      ref={setNodeRef}
      style={style}
      className="group/project"
    >
      <tr className="bg-muted/30 font-semibold text-[12px]">
        <td className={`${freeze ? 'sticky left-0 z-2' : ''} bg-inherit border-b border-r border-border`}>
          <div className="flex items-center px-1 py-1 gap-0.5">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab text-muted-foreground p-0.5"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-3 w-3" />
            </button>
            <StatusPicker
              value={project.status}
              onChange={(v) => updateProject(project.id, { status: v })}
            />
          </div>
        </td>
        <td className={`${freeze ? 'sticky left-27.5 z-2' : ''} bg-inherit border-b border-r border-border`} />
        <td className={`${freeze ? 'sticky left-49 z-2' : ''} bg-inherit border-b border-r border-border`} />
        <td className={`${freeze ? 'sticky left-66 z-2' : ''} bg-inherit border-b border-r-2 border-border min-w-65`}>
          <div className="flex items-center px-2 py-1 gap-1">
            <button
              onClick={() => updateProject(project.id, { expanded: !project.expanded })}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              aria-label={project.expanded ? 'Collapse' : 'Expand'}
              aria-expanded={project.expanded}
            >
              {project.expanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            <input
              className="flex-1 bg-transparent outline-none text-[12px] font-semibold min-w-0 px-1"
              value={project.name}
              onChange={(e) => updateProject(project.id, { name: e.target.value })}
              aria-label="Project name"
            />
          </div>
        </td>
        <td className="border-b border-r border-border" />
        <td className="border-b border-r border-border px-2 text-[11px] font-mono text-muted-foreground">
          {pRange?.start ?? ''}
        </td>
        <td className="border-b border-r border-border px-2 text-[11px] font-mono text-muted-foreground">
          {pRange?.end ?? ''}
        </td>
        <td className="border-b border-r border-border text-center text-[11px] font-mono text-muted-foreground">
          {pDays || ''}
        </td>
        <td className="border-b border-r border-border">
          <input
            className="w-full bg-transparent outline-none text-[12px] px-2 py-1"
            value={project.deliverable}
            onChange={(e) => updateProject(project.id, { deliverable: e.target.value })}
            placeholder="—"
            aria-label="Deliverable"
          />
        </td>
        <td className="border-b border-r border-border" />
        <td className="border-b border-r-2 border-border text-center">
          <button
            onClick={() => deleteProject(project.id)}
            className="p-1 text-muted-foreground hover:text-destructive"
            aria-label="Delete project"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
        {cols.map((c, k) => {
          const isWkStart = c.dayIndex === 0 && c.weekIndex > 0;
          const isHol = isHoliday(c.dateStr, holidays);
          const isTod = isToday(c.dateStr);
          return (
            <td
              key={c.dateStr}
              className={[
                'relative h-9 border-b border-r border-border',
                isWkStart ? 'border-l-2' : '',
                isHol ? 'bg-yellow-50 dark:bg-yellow-950/20' : '',
                isTod ? 'bg-red-50/30 dark:bg-red-950/10' : '',
              ].join(' ')}
            >
              {isTod && (
                <div className="absolute inset-y-0 left-1/2 w-px bg-red-500/40 z-0" />
              )}
              {k === pStartCol && pStartCol !== -1 && (
                <GanttBar
                  startCol={0}
                  endCol={pEndCol - pStartCol}
                  totalCols={cols.length - pStartCol}
                  priority={null}
                  label={project.name}
                  isProject
                />
              )}
            </td>
          );
        })}
      </tr>

      {project.expanded && (
        <DndContext sensors={taskSensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
          <SortableContext items={project.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {project.tasks.map((task) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                projectId={project.id}
                cols={cols}
                holidays={holidays}
                freeze={freeze}
                ownerSuggestions={ownerSuggestions}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {project.expanded && (
        <tr data-add-task-row>
          <td colSpan={totalCols} className="border-b border-border p-0">
            <button
              onClick={() => addTask(project.id)}
              className="w-full text-left text-[11px] text-muted-foreground hover:bg-muted/50 px-9 py-1.5 border-b border-dashed border-border transition-colors"
            >
              <Plus className="inline h-3 w-3 mr-1" />
              Add task to &ldquo;{project.name}&rdquo;
            </button>
          </td>
        </tr>
      )}
    </tbody>
  );
}

// ─── Task Row ────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  projectId: string;
  cols: ReturnType<typeof generateColumns>;
  holidays: string[];
  freeze: boolean;
  ownerSuggestions: string[];
}

function SortableTaskRow({ task, projectId, cols, holidays, freeze, ownerSuggestions }: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateTask = useTimelineStore((s) => s.updateTask);
  const addTask = useTimelineStore((s) => s.addTask);
  const deleteTask = useTimelineStore((s) => s.deleteTask);

  const startCol = colIndexFromDate(task.startDate, cols) ?? 0;
  const endCol = colIndexFromDate(task.endDate, cols) ?? 0;
  const days = workingDaysBetween(task.startDate, task.endDate, holidays);

  function handleBarUpdate(ns: number, ne: number) {
    const absNs = Math.max(0, Math.min(startCol + ns, cols.length - 1));
    const absNe = Math.max(0, Math.min(startCol + ne, cols.length - 1));
    updateTask(projectId, task.id, {
      startDate: cols[absNs]?.dateStr ?? task.startDate,
      endDate: cols[absNe]?.dateStr ?? task.endDate,
    });
  }

  function handleTaskNameKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;

    event.preventDefault();

    const newTaskId = addTask(projectId, task.id);
    if (!newTaskId) return;

    requestAnimationFrame(() => {
      const nextTaskInput = document.querySelector<HTMLInputElement>(
        `input[data-task-name-input="true"][data-task-id="${newTaskId}"]`
      );

      nextTaskInput?.focus();
      nextTaskInput?.select();
    });
  }

  const pct = Math.max(0, Math.min(100, task.percentComplete));

  return (
    <tr ref={setNodeRef} style={style} className="group/task text-[12px]">
      <td className={`${freeze ? 'sticky left-0 z-2' : ''} bg-background border-b border-r border-border`}>
        <div className="flex items-center px-1 py-1 gap-0.5">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground p-0.5"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <StatusPicker
            value={task.status}
            onChange={(v) => updateTask(projectId, task.id, { status: v })}
          />
        </div>
      </td>
      <td className={`${freeze ? 'sticky left-27.5 z-2' : ''} bg-background border-b border-r border-border`}>
        <div className="px-1 py-1">
          <PriorityPicker
            value={task.priority}
            onChange={(v) => updateTask(projectId, task.id, { priority: v })}
          />
        </div>
      </td>
      <td className={`${freeze ? 'sticky left-49 z-2' : ''} bg-background border-b border-r border-border`}>
        <div className="flex items-center justify-center px-2 py-1">
          <TaskColorPicker
            value={task.color}
            priority={task.priority}
            onChange={(value) => updateTask(projectId, task.id, { color: value })}
          />
        </div>
      </td>
      <td className={`${freeze ? 'sticky left-66 z-2' : ''} bg-background border-b border-r-2 border-border`}>
        <div className="flex items-center pl-8 pr-2 relative">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 w-2 h-px bg-border" />
          <input
            className="w-full bg-transparent outline-none text-[12px] py-1 min-w-0 hover:bg-muted/30 focus:bg-background focus:ring-1 focus:ring-inset focus:ring-foreground/30 rounded px-1"
            value={task.name}
            onChange={(e) => updateTask(projectId, task.id, { name: e.target.value })}
            onKeyDown={handleTaskNameKeyDown}
            aria-label="Task name"
            data-task-name-input="true"
            data-task-id={task.id}
          />
        </div>
      </td>
      <td className="border-b border-r border-border">
        <input
          className="w-full bg-transparent outline-none text-[12px] px-2 py-1 hover:bg-muted/30 focus:ring-1 focus:ring-inset focus:ring-foreground/30 rounded"
          value={task.owner}
          onChange={(e) => updateTask(projectId, task.id, { owner: e.target.value })}
          placeholder="—"
          aria-label="Owner"
          list={`owner-suggestions-${task.id}`}
        />
        <datalist id={`owner-suggestions-${task.id}`}>
          {ownerSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </td>
      <td className="border-b border-r border-border p-0">
        <DatePicker
          value={task.startDate}
          onChange={(d) => updateTask(projectId, task.id, { startDate: d })}
        />
      </td>
      <td className="border-b border-r border-border p-0">
        <DatePicker
          value={task.endDate}
          onChange={(d) => updateTask(projectId, task.id, { endDate: d })}
        />
      </td>
      <td className="border-b border-r border-border text-center text-[11px] font-mono text-muted-foreground">
        {days || ''}
      </td>
      <td className="border-b border-r border-border">
        <input
          className="w-full bg-transparent outline-none text-[12px] px-2 py-1 hover:bg-muted/30"
          value={task.deliverable}
          onChange={(e) => updateTask(projectId, task.id, { deliverable: e.target.value })}
          placeholder="—"
          aria-label="Deliverable"
        />
      </td>
      <td className="border-b border-r border-border p-0">
        <div className="flex items-center gap-1.5 px-2 py-1">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <input
            type="number"
            min={0}
            max={100}
            className="w-12 text-[10px] font-mono text-right bg-transparent outline-none border border-transparent hover:border-border rounded px-0.5"
            value={pct}
            onChange={(e) =>
              updateTask(projectId, task.id, {
                percentComplete: Math.max(0, Math.min(100, Number(e.target.value))),
              })
            }
            aria-label="Percent complete"
          />
        </div>
      </td>
      <td className="border-b border-r-2 border-border text-center">
        <Popover>
          <PopoverTrigger
            className="p-1 text-muted-foreground hover:text-destructive rounded"
            aria-label="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </PopoverTrigger>
          <PopoverContent className="w-56" side="left" align="center">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                Delete this task?
              </div>
              <p className="text-xs text-muted-foreground">This action cannot be undone. Well, actually Cmd+Z works.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => deleteTask(projectId, task.id)}>
                  Delete
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </td>
      {cols.map((c, k) => {
        const isWkStart = c.dayIndex === 0 && c.weekIndex > 0;
        const isHol = isHoliday(c.dateStr, holidays);
        const isTod = isToday(c.dateStr);
        return (
          <td
            key={c.dateStr}
            className={[
              'relative h-9 border-b border-r border-border',
              isWkStart ? 'border-l-2' : '',
              isHol ? 'bg-yellow-50 dark:bg-yellow-950/20' : '',
              isTod ? 'bg-red-50/30 dark:bg-red-950/10' : '',
            ].join(' ')}
          >
            {isTod && (
              <div className="absolute inset-y-0 left-1/2 w-px bg-red-500/40 z-0" />
            )}
            {k === startCol && (
              <GanttBar
                startCol={0}
                endCol={endCol - startCol}
                totalCols={cols.length - startCol}
                priority={task.priority}
                taskColor={task.color}
                label={task.name}
                percent={pct}
                onUpdate={handleBarUpdate}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ─── Main Table ──────────────────────────────────────────────────────────────

interface TimelineTableProps { freeze: boolean; }

export function TimelineTable({ freeze }: TimelineTableProps) {
  const timeline = useTimelineStore((s) => s.timeline);
  const moveProject = useTimelineStore((s) => s.moveProject);
  const tableRef = useRef<HTMLDivElement>(null);

  const cols = useMemo(
    () =>
      timeline
        ? generateColumns(timeline.startDate, timeline.weeks)
        : [],
    [timeline?.startDate, timeline?.weeks]
  );

  const ownerSuggestions = useMemo(
    () =>
      timeline
        ? [
            ...new Set(
              timeline.projects
                .flatMap((p) => p.tasks.map((t) => t.owner))
                .filter((o): o is string => typeof o === 'string' && o.trim() !== '')
            ),
          ]
        : [],
    [timeline]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (!timeline) return null;

  function handleProjectDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !timeline) return;
    const fromIdx = timeline.projects.findIndex((p) => p.id === active.id);
    const toIdx = timeline.projects.findIndex((p) => p.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) moveProject(fromIdx, toIdx);
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const totalCols = 11 + cols.length;

  const weekGroups: { weekIndex: number; span: number }[] = [];
  let wi = 0;
  while (wi < cols.length) {
    const w = cols[wi].weekIndex;
    let j = wi;
    while (j < cols.length && cols[j].weekIndex === w) j++;
    weekGroups.push({ weekIndex: w, span: j - wi });
    wi = j;
  }

  return (
    <div ref={tableRef} className="table-scroll flex-1 overflow-auto relative" data-table-wrap>
      <table
        className="border-collapse text-[12px]"
        style={{ width: 'max-content', minWidth: '100%' }}
      >
        <thead className="sticky top-0 z-10">
          <tr>
            <th className={`${freeze ? 'sticky left-0 z-5' : ''} bg-muted border-b-2 border-r border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 text-left w-27.5 min-w-27.5`} rowSpan={2}>
              Status
            </th>
            <th className={`${freeze ? 'sticky left-27.5 z-5' : ''} bg-muted border-b-2 border-r border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 text-left w-21.5 min-w-21.5`} rowSpan={2}>
              Priority
            </th>
            <th className={`${freeze ? 'sticky left-49 z-5' : ''} bg-muted border-b-2 border-r border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 text-center w-17 min-w-17`} rowSpan={2}>
              Color
            </th>
            <th className={`${freeze ? 'sticky left-66 z-5' : ''} bg-muted border-b-2 border-r-2 border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 text-left w-65 min-w-65`} rowSpan={2}>
              Project + Task
            </th>
            <th className="bg-muted border-b-2 border-r border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 text-left w-27.5" rowSpan={2}>Owner</th>
            <th className="bg-muted border-b-2 border-r border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 text-left w-25" rowSpan={2}>Start</th>
            <th className="bg-muted border-b-2 border-r border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 text-left w-25" rowSpan={2}>End</th>
            <th className="bg-muted border-b-2 border-r border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 text-center w-14" rowSpan={2}>Days</th>
            <th className="bg-muted border-b-2 border-r border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 text-left w-35" rowSpan={2}>Deliverable</th>
            <th className="bg-muted border-b-2 border-r border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2 text-center w-30" rowSpan={2}>%</th>
            <th className="bg-muted border-b-2 border-r-2 border-border w-12.5" rowSpan={2} data-pdf-hide />
            {weekGroups.map((w) => (
              <th
                key={w.weekIndex}
                colSpan={w.span}
                className={[
                  'bg-muted border-b border-r border-border text-center text-[10px] font-mono text-muted-foreground py-1.5',
                  w.weekIndex > 0 ? 'border-l-2' : '',
                ].join(' ')}
              >
                Wk {w.weekIndex + 1}
              </th>
            ))}
          </tr>
          <tr>
            {cols.map((c) => {
              const isTod = c.dateStr === todayStr;
              const isWkStart = c.dayIndex === 0 && c.weekIndex > 0;
              return (
                <th
                  key={c.dateStr}
                  className={[
                    'bg-muted border-b-2 border-r border-border text-center font-mono text-[10px] py-1',
                    'w-8 min-w-8',
                    isTod ? 'text-red-500 font-semibold bg-red-50 dark:bg-red-950/20' : 'text-muted-foreground',
                    isWkStart ? 'border-l-2' : '',
                  ].join(' ')}
                >
                  {c.date.getDate()}
                  <span className={['block text-[9px]', isTod ? 'text-red-400' : 'text-muted-foreground/60'].join(' ')}>
                    {DAY_LABELS[c.dayIndex]}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
          <SortableContext items={timeline.projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {timeline.projects.map((project) => (
              <SortableProjectRow
                key={project.id}
                project={project}
                cols={cols}
                holidays={timeline.holidays}
                freeze={freeze}
                ownerSuggestions={ownerSuggestions}
              />
            ))}
          </SortableContext>
        </DndContext>

        {timeline.projects.length === 0 && (
          <tbody>
            <tr>
              <td colSpan={totalCols} className="text-center py-16 text-muted-foreground text-sm">
                No projects yet — click &ldquo;+ Group&rdquo; in the toolbar to get started.
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}
