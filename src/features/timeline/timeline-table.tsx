import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { AnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { generateColumns, workingDaysBetween, isToday, isHoliday, DAY_LABELS, colIndexFromDate } from '@/lib/date-utils';
import { useTimelineStore } from '@/store/timeline-store';
import { StatusPicker } from './status-picker';
import { PriorityPicker } from './priority-picker';
import { TaskColorPicker } from './task-color-picker';
import { GanttBar } from './gantt-bar';
import { DatePicker } from '@/components/ui/date-picker';
import { DeferredInput } from '@/components/deferred-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { Project, Task } from '@/lib/types';

const dndAccessibility = typeof document === 'undefined'
  ? undefined
  : { container: document.body };

const dragHandleStyle: React.CSSProperties = {
  touchAction: 'none',
  userSelect: 'none',
};

type SortableItemType = 'project' | 'task';

const disableRowLayoutAnimation: AnimateLayoutChanges = () => false;

// ─── Project Row ────────────────────────────────────────────────────────────

interface ProjectRowProps {
  project: Project;
  cols: ReturnType<typeof generateColumns>;
  holidays: string[];
  freeze: boolean;
  ownerSuggestions: string[];
}

interface ProjectTimelineCellsProps {
  cols: ReturnType<typeof generateColumns>;
  holidays: string[];
  label: string;
  startCol: number;
  endCol: number;
}

const ProjectTimelineCells = React.memo(function ProjectTimelineCells({
  cols,
  holidays,
  label,
  startCol,
  endCol,
}: ProjectTimelineCellsProps) {
  return (
    <>
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
            {k === startCol && startCol !== -1 && (
              <GanttBar
                startCol={0}
                endCol={endCol - startCol}
                totalCols={cols.length - startCol}
                priority={null}
                label={label}
                isProject
              />
            )}
          </td>
        );
      })}
    </>
  );
});

interface TaskTimelineCellsProps {
  cols: ReturnType<typeof generateColumns>;
  holidays: string[];
  label: string;
  priority: Task['priority'];
  taskColor: Task['color'];
  percent: number;
  startCol: number;
  endCol: number;
  onUpdate: (newStart: number, newEnd: number) => void;
}

type ActiveDragItem =
  | {
      type: 'project';
      label: string;
      meta: string;
    }
  | {
      type: 'task';
      label: string;
      meta: string;
      submeta: string;
    };

function DragPreview({ item }: { item: ActiveDragItem }) {
  return (
    <div
      data-drag-preview
      className="pointer-events-none min-w-72 rounded-xl border border-border bg-background/95 px-3 py-2 shadow-2xl backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{item.label}</span>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {item.meta}
      </div>
      {item.type === 'task' && (
        <div className="text-[10px] text-muted-foreground/80">
          {item.submeta}
        </div>
      )}
    </div>
  );
}

const TaskTimelineCells = React.memo(function TaskTimelineCells({
  cols,
  holidays,
  label,
  priority,
  taskColor,
  percent,
  startCol,
  endCol,
  onUpdate,
}: TaskTimelineCellsProps) {
  return (
    <>
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
                priority={priority}
                taskColor={taskColor}
                label={label}
                percent={percent}
                onUpdate={onUpdate}
              />
            )}
          </td>
        );
      })}
    </>
  );
});

const SortableProjectRow = React.memo(function SortableProjectRow({ project, cols, holidays, freeze, ownerSuggestions }: ProjectRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: project.id,
      data: { type: 'project' satisfies SortableItemType, projectId: project.id },
      animateLayoutChanges: disableRowLayoutAnimation,
      transition: null,
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const updateProject = useTimelineStore((s) => s.updateProject);
  const deleteProject = useTimelineStore((s) => s.deleteProject);
  const addTask = useTimelineStore((s) => s.addTask);

  // Stable task id list — ref only changes when the ORDER/count of tasks
  // changes (not when task fields are edited). This keeps dnd-kit's
  // SortableContext from invalidating its context value on every keystroke,
  // which would otherwise force every useSortable child to re-render.
  const taskIdsKey = project.tasks.map((t) => t.id).join('\u0001');
  const taskIds = useMemo(
    () => (taskIdsKey ? taskIdsKey.split('\u0001') : []),
    [taskIdsKey],
  );

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
              style={dragHandleStyle}
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
            <DeferredInput
              className="flex-1 bg-transparent outline-none text-[12px] font-semibold min-w-0 px-1"
              value={project.name}
              onCommit={(v) => updateProject(project.id, { name: v })}
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
          <DeferredInput
            className="w-full bg-transparent outline-none text-[12px] px-2 py-1"
            value={project.deliverable}
            onCommit={(v) => updateProject(project.id, { deliverable: v })}
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
        <ProjectTimelineCells
          cols={cols}
          holidays={holidays}
          label={project.name}
          startCol={pStartCol}
          endCol={pEndCol}
        />
      </tr>

      {project.expanded && (
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
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
});

// ─── Task Row ────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  projectId: string;
  cols: ReturnType<typeof generateColumns>;
  holidays: string[];
  freeze: boolean;
  ownerSuggestions: string[];
}

const SortableTaskRow = React.memo(function SortableTaskRow({ task, projectId, cols, holidays, freeze, ownerSuggestions }: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: task.id,
      data: { type: 'task' satisfies SortableItemType, projectId, taskId: task.id },
      animateLayoutChanges: disableRowLayoutAnimation,
      transition: null,
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const updateTask = useTimelineStore((s) => s.updateTask);
  const addTask = useTimelineStore((s) => s.addTask);
  const deleteTask = useTimelineStore((s) => s.deleteTask);

  const startCol = colIndexFromDate(task.startDate, cols) ?? 0;
  const endCol = colIndexFromDate(task.endDate, cols) ?? 0;
  const days = workingDaysBetween(task.startDate, task.endDate, holidays);

  const handleBarUpdate = useCallback((ns: number, ne: number) => {
    const absNs = Math.max(0, Math.min(startCol + ns, cols.length - 1));
    const absNe = Math.max(0, Math.min(startCol + ne, cols.length - 1));
    updateTask(projectId, task.id, {
      startDate: cols[absNs]?.dateStr ?? task.startDate,
      endDate: cols[absNe]?.dateStr ?? task.endDate,
    });
  }, [cols, endCol, projectId, startCol, task.endDate, task.id, task.startDate, updateTask]);

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
            style={dragHandleStyle}
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
          <DeferredInput
            className="w-full bg-transparent outline-none text-[12px] py-1 min-w-0 hover:bg-muted/30 focus:bg-background focus:ring-1 focus:ring-inset focus:ring-foreground/30 rounded px-1"
            value={task.name}
            onCommit={(v) => updateTask(projectId, task.id, { name: v })}
            onKeyDown={handleTaskNameKeyDown}
            aria-label="Task name"
            data-task-name-input="true"
            data-task-id={task.id}
          />
        </div>
      </td>
      <td className="border-b border-r border-border">
        <DeferredInput
          className="w-full bg-transparent outline-none text-[12px] px-2 py-1 hover:bg-muted/30 focus:ring-1 focus:ring-inset focus:ring-foreground/30 rounded"
          value={task.owner}
          onCommit={(v) => updateTask(projectId, task.id, { owner: v })}
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
        <DeferredInput
          className="w-full bg-transparent outline-none text-[12px] px-2 py-1 hover:bg-muted/30"
          value={task.deliverable}
          onCommit={(v) => updateTask(projectId, task.id, { deliverable: v })}
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
      <TaskTimelineCells
        cols={cols}
        holidays={holidays}
        label={task.name}
        priority={task.priority}
        taskColor={task.color}
        percent={pct}
        startCol={startCol}
        endCol={endCol}
        onUpdate={handleBarUpdate}
      />
    </tr>
  );
});

// ─── Main Table ──────────────────────────────────────────────────────────────

interface TimelineTableProps { freeze: boolean; }

export function TimelineTable({ freeze }: TimelineTableProps) {
  const timeline = useTimelineStore((s) => s.timeline);
  const moveProject = useTimelineStore((s) => s.moveProject);
  const moveTask = useTimelineStore((s) => s.moveTask);
  const tableRef = useRef<HTMLDivElement>(null);
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);

  const cols = useMemo(
    () =>
      timeline
        ? generateColumns(timeline.startDate, timeline.weeks)
        : [],
    [timeline?.startDate, timeline?.weeks]
  );

  const projects = timeline?.projects;

  // Compute a stable string key of owners so the array identity only changes
  // when the actual owner set changes (not on every keystroke).
  const ownerKey = useMemo(() => {
    if (!projects) return '';
    const set = new Set<string>();
    for (const p of projects) {
      for (const t of p.tasks) {
        if (typeof t.owner === 'string' && t.owner.trim() !== '') {
          set.add(t.owner);
        }
      }
    }
    return [...set].sort().join('\u0001');
  }, [projects]);

  const ownerSuggestions = useMemo(
    () => (ownerKey ? ownerKey.split('\u0001') : []),
    [ownerKey],
  );

  // Stable project id list (same reasoning as taskIds inside project row).
  const projectIdsKey = projects ? projects.map((p) => p.id).join('\u0001') : '';
  const projectIds = useMemo(
    () => (projectIdsKey ? projectIdsKey.split('\u0001') : []),
    [projectIdsKey],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!projects) return;

    const activeId = String(event.active.id);
    const activeType = event.active.data.current?.type as SortableItemType | undefined;

    if (activeType === 'project') {
      const project = projects.find((entry) => entry.id === activeId);
      if (!project) return;
      setActiveDragItem({
        type: 'project',
        label: project.name,
        meta: `${project.tasks.length} task${project.tasks.length === 1 ? '' : 's'}`,
      });
      return;
    }

    if (activeType !== 'task') return;

    const projectId = String(event.active.data.current?.projectId ?? '');
    const project = projects.find((entry) => entry.id === projectId);
    const task = project?.tasks.find((entry) => entry.id === activeId);
    if (!project || !task) return;

    setActiveDragItem({
      type: 'task',
      label: task.name,
      meta: project.name,
      submeta: `${task.startDate} -> ${task.endDate}`,
    });
  }, [projects]);

  const handleDragCancel = useCallback(() => {
    setActiveDragItem(null);
  }, []);

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeType = args.active.data.current?.type as SortableItemType | undefined;

    if (activeType !== 'task') {
      return closestCenter(args);
    }

    const taskContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === 'task'
    );
    const taskCollisions = closestCenter({
      ...args,
      droppableContainers: taskContainers,
    });

    if (taskCollisions.length > 0) {
      return taskCollisions;
    }

    const projectContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === 'project'
    );

    return closestCenter({
      ...args,
      droppableContainers: projectContainers,
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragItem(null);

    const { active, over } = event;
    if (!over || !projects) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeType = active.data.current?.type as SortableItemType | undefined;
    const overType = over.data.current?.type as SortableItemType | undefined;

    if (activeType === 'project') {
      const targetProjectId = overType === 'task'
        ? String(over.data.current?.projectId ?? '')
        : overId;

      if (!targetProjectId || activeId === targetProjectId) return;

      const fromIdx = projects.findIndex((project) => project.id === activeId);
      const toIdx = projects.findIndex((project) => project.id === targetProjectId);
      if (fromIdx !== -1 && toIdx !== -1) moveProject(fromIdx, toIdx);
      return;
    }

    if (activeType !== 'task') return;

    const fromProjectId = String(active.data.current?.projectId ?? '');
    if (!fromProjectId) return;

    const fromProject = projects.find((project) => project.id === fromProjectId);
    if (!fromProject) return;

    const fromIdx = fromProject.tasks.findIndex((task) => task.id === activeId);
    if (fromIdx === -1) return;

    let toProjectId = '';
    let toIdx = -1;

    if (overType === 'task') {
      toProjectId = String(over.data.current?.projectId ?? '');
      const toProject = projects.find((project) => project.id === toProjectId);
      if (!toProject) return;
      toIdx = toProject.tasks.findIndex((task) => task.id === overId);
    } else if (overType === 'project') {
      toProjectId = overId;
      const toProject = projects.find((project) => project.id === toProjectId);
      if (!toProject) return;
      toIdx = toProject.tasks.length;
    }

    if (!toProjectId || toIdx === -1) return;
    if (fromProjectId === toProjectId && (activeId === overId || fromIdx === toIdx)) return;

    moveTask(fromProjectId, fromIdx, toProjectId, toIdx);
  }, [moveProject, moveTask, projects]);

  if (!timeline) return null;

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
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      accessibility={dndAccessibility}
    >
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

          <SortableContext items={projectIds} strategy={verticalListSortingStrategy}>
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
      <DragOverlay dropAnimation={null}>
        {activeDragItem ? <DragPreview item={activeDragItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
