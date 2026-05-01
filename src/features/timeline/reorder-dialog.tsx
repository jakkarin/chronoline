import { useCallback, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Project, Task } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTimelineStore } from '@/store/timeline-store';

interface ReorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ReorderDragData =
  | { type: 'project'; projectId: string }
  | { type: 'task'; projectId: string; taskId: string }
  | { type: 'task-list'; projectId: string };

type ActiveDragItem =
  | { type: 'project'; project: Project }
  | { type: 'task'; task: Task; projectName: string };

const dragHandleStyle = {
  touchAction: 'none',
  userSelect: 'none',
} as const;

function cloneProjects(projects: Project[]): Project[] {
  return projects.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => ({ ...task })),
  }));
}

function findTaskLocation(projects: Project[], taskId: string) {
  for (let projectIndex = 0; projectIndex < projects.length; projectIndex += 1) {
    const taskIndex = projects[projectIndex].tasks.findIndex((task) => task.id === taskId);
    if (taskIndex !== -1) {
      return { projectIndex, taskIndex };
    }
  }

  return null;
}

function ProjectCard({
  project,
  children,
}: {
  project: Project;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: project.id,
    data: { type: 'project', projectId: project.id } satisfies ReorderDragData,
  });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-xl border border-border bg-card shadow-xs transition-colors',
        isDragging && 'opacity-35',
        isOver && 'border-primary/50 bg-primary/5'
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{project.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {project.tasks.length} tasks
          </span>
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
            style={dragHandleStyle}
            aria-label={`Reorder group ${project.name}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
      {children}
    </section>
  );
}

function TaskListDropZone({
  projectId,
  hasTasks,
  children,
}: {
  projectId: string;
  hasTasks: boolean;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `task-list:${projectId}`,
    data: { type: 'task-list', projectId } satisfies ReorderDragData,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-b-xl p-2 transition-colors',
        hasTasks ? 'space-y-1.5' : 'min-h-18',
        isOver && 'bg-primary/5'
      )}
    >
      {children}
      {!hasTasks && (
        <div className="flex min-h-14 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
          Drop tasks here
        </div>
      )}
    </div>
  );
}

function TaskRow({
  projectId,
  task,
}: {
  projectId: string;
  task: Task;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: task.id,
    data: { type: 'task', projectId, taskId: task.id } satisfies ReorderDragData,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 transition-colors',
        isDragging && 'opacity-35',
        isOver && 'border-primary/50 bg-primary/5'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
        style={dragHandleStyle}
        aria-label={`Reorder task ${task.name}`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{task.name}</div>
      </div>
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        {task.status}
      </span>
    </div>
  );
}

function DragPreview({ item }: { item: ActiveDragItem }) {
  if (item.type === 'project') {
    return (
      <div className="w-[min(32rem,calc(100vw-4rem))] rounded-2xl border border-border bg-popover px-4 py-3 shadow-xl" data-drag-preview>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Group</div>
        <div className="mt-1 text-sm font-semibold text-foreground">{item.project.name}</div>
        <div className="mt-2 text-xs text-muted-foreground">{item.project.tasks.length} tasks</div>
      </div>
    );
  }

  return (
    <div className="w-[min(28rem,calc(100vw-4rem))] rounded-2xl border border-border bg-popover px-4 py-3 shadow-xl" data-drag-preview>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Task</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{item.task.name}</div>
      <div className="mt-2 text-xs text-muted-foreground">{item.projectName}</div>
    </div>
  );
}

export function ReorderDialog({ open, onOpenChange }: ReorderDialogProps) {
  const timeline = useTimelineStore((state) => state.timeline);
  const setTimeline = useTimelineStore((state) => state.setTimeline);
  const [draftProjects, setDraftProjects] = useState<Project[]>(() => cloneProjects(timeline?.projects ?? []));
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const projectIds = useMemo(() => draftProjects.map((project) => project.id), [draftProjects]);

  const hasChanges = useMemo(() => {
    if (!timeline) return false;
    if (timeline.projects.length !== draftProjects.length) return true;

    return timeline.projects.some((project, projectIndex) => {
      const draftProject = draftProjects[projectIndex];
      if (!draftProject || draftProject.id !== project.id || draftProject.tasks.length !== project.tasks.length) {
        return true;
      }

      return project.tasks.some((task, taskIndex) => draftProject.tasks[taskIndex]?.id !== task.id);
    });
  }, [draftProjects, timeline]);

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeData = args.active.data.current as ReorderDragData | undefined;

    if (activeData?.type === 'project') {
      const projectContainers = args.droppableContainers.filter(
        (container) => container.data.current?.type === 'project'
      );

      return closestCenter({ ...args, droppableContainers: projectContainers });
    }

    if (activeData?.type === 'task') {
      const taskContainers = args.droppableContainers.filter((container) => {
        const type = container.data.current?.type;
        return type === 'task' || type === 'task-list';
      });

      const pointerHits = pointerWithin({ ...args, droppableContainers: taskContainers });
      if (pointerHits.length > 0) return pointerHits;

      const taskHits = closestCenter({ ...args, droppableContainers: taskContainers });
      if (taskHits.length > 0) return taskHits;

      const projectContainers = args.droppableContainers.filter(
        (container) => container.data.current?.type === 'project'
      );

      return closestCenter({ ...args, droppableContainers: projectContainers });
    }

    return closestCenter(args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeData = event.active.data.current as ReorderDragData | undefined;
    if (!activeData) return;

    if (activeData.type === 'project') {
      const project = draftProjects.find((entry) => entry.id === activeData.projectId);
      if (project) {
        setActiveDragItem({ type: 'project', project });
      }
      return;
    }

    if (activeData.type === 'task') {
      const project = draftProjects.find((entry) => entry.id === activeData.projectId);
      const task = project?.tasks.find((entry) => entry.id === activeData.taskId);
      if (project && task) {
        setActiveDragItem({ type: 'task', task, projectName: project.name });
      }
    }
  }, [draftProjects]);

  const handleDragCancel = useCallback(() => {
    setActiveDragItem(null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const activeData = event.active.data.current as ReorderDragData | undefined;
    const overData = event.over?.data.current as ReorderDragData | undefined;

    setActiveDragItem(null);

    if (!activeData || !overData || event.active.id === event.over?.id) {
      return;
    }

    setDraftProjects((current) => {
      if (activeData.type === 'project' && overData.type === 'project') {
        const fromIndex = current.findIndex((project) => project.id === activeData.projectId);
        const toIndex = current.findIndex((project) => project.id === overData.projectId);

        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
          return current;
        }

        return arrayMove(current, fromIndex, toIndex);
      }

      if (activeData.type !== 'task') {
        return current;
      }

      const nextProjects = cloneProjects(current);
      const source = findTaskLocation(nextProjects, activeData.taskId);
      if (!source) return current;

      if (overData.type === 'task') {
        const target = findTaskLocation(nextProjects, overData.taskId);
        if (!target) return current;

        if (source.projectIndex === target.projectIndex) {
          if (source.taskIndex === target.taskIndex) return current;

          nextProjects[source.projectIndex].tasks = arrayMove(
            nextProjects[source.projectIndex].tasks,
            source.taskIndex,
            target.taskIndex
          );

          return nextProjects;
        }

        const [movedTask] = nextProjects[source.projectIndex].tasks.splice(source.taskIndex, 1);
        if (!movedTask) return current;

        nextProjects[target.projectIndex].tasks.splice(target.taskIndex, 0, movedTask);
        nextProjects[source.projectIndex].expanded = true;
        nextProjects[target.projectIndex].expanded = true;
        return nextProjects;
      }

      if (overData.type !== 'task-list' && overData.type !== 'project') {
        return current;
      }

      const destinationIndex = nextProjects.findIndex((project) => project.id === overData.projectId);
      if (destinationIndex === -1) return current;

      const [movedTask] = nextProjects[source.projectIndex].tasks.splice(source.taskIndex, 1);
      if (!movedTask) return current;

      nextProjects[destinationIndex].tasks.push(movedTask);
      nextProjects[source.projectIndex].expanded = true;
      nextProjects[destinationIndex].expanded = true;
      return nextProjects;
    });
  }, []);

  const handleApply = useCallback(() => {
    if (!timeline) return;

    setTimeline({
      ...timeline,
      projects: cloneProjects(draftProjects),
    });
    onOpenChange(false);
  }, [draftProjects, onOpenChange, setTimeline, timeline]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[calc(100%-2rem)] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>Reorder Groups and Tasks</DialogTitle>
          <DialogDescription>
            Drag groups or tasks in this list view, then apply the new order back to the timeline table.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
          {draftProjects.length === 0 ? (
            <div className="flex min-h-40 flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
              Add a group first to start arranging the timeline.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={handleDragStart}
              onDragCancel={handleDragCancel}
              onDragEnd={handleDragEnd}
            >
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <SortableContext items={projectIds} strategy={verticalListSortingStrategy}>
                  {draftProjects.map((project) => (
                    <ProjectCard key={project.id} project={project}>
                      <SortableContext
                        items={project.tasks.map((task) => task.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <TaskListDropZone projectId={project.id} hasTasks={project.tasks.length > 0}>
                          {project.tasks.map((task) => (
                            <TaskRow key={task.id} projectId={project.id} task={task} />
                          ))}
                        </TaskListDropZone>
                      </SortableContext>
                    </ProjectCard>
                  ))}
                </SortableContext>
              </div>
              <DragOverlay dropAnimation={null}>
                {activeDragItem ? <DragPreview item={activeDragItem} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!timeline || !hasChanges}>
            Apply Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}