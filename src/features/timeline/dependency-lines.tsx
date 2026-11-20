import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useLinkDrag } from '@/store/link-drag';
import { useTimelineStore } from '@/store/timeline-store';

interface Line {
  childId: string;
  parentId: string;
  follow: boolean;
  d: string;
}

interface OpenLink {
  childId: string;
  parentId: string;
  x: number;
  y: number;
}

/** Elbow path from a parent bar's right-middle to a child bar's left-middle. */
function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  if (x2 - x1 >= 16) {
    const xm = x1 + 8;
    return `M ${x1} ${y1} H ${xm} V ${y2} H ${x2}`;
  }
  // Child starts before the parent ends: step out, cross between the rows, come back in.
  const yMid = (y1 + y2) / 2;
  return `M ${x1} ${y1} h 8 V ${yMid} H ${x2 - 8} V ${y2} H ${x2}`;
}

/**
 * Lines between linked task bars, drawn in an SVG layer inside the table's scroll
 * container (content coordinates, so scrolling needs no re-measure). Lines whose
 * bars aren't rendered (collapsed project, outside the grid) are skipped.
 */
export function DependencyLines({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const timeline = useTimelineStore((s) => s.timeline);
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [open, setOpen] = useState<OpenLink | null>(null);
  const linkDrag = useLinkDrag((s) => s.drag);
  const [dragPath, setDragPath] = useState<string | null>(null);

  // Temporary line while dragging from a bar's link dot, in content coordinates.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const fromBar = linkDrag && container?.querySelector<HTMLElement>(`[data-bar-task-id="${linkDrag.fromTaskId}"]`);
    if (!linkDrag || !container || !fromBar) {
      setDragPath(null);
      return;
    }
    const c = container.getBoundingClientRect();
    const r = fromBar.getBoundingClientRect();
    const x1 = r.right - c.left + container.scrollLeft;
    const y1 = r.top - c.top + container.scrollTop + r.height / 2;
    setDragPath(`M ${x1} ${y1} L ${linkDrag.x - c.left + container.scrollLeft} ${linkDrag.y - c.top + container.scrollTop}`);
  }, [containerRef, linkDrag]);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || !timeline) return;
    const c = container.getBoundingClientRect();
    const toContent = (r: DOMRect) => ({
      left: r.left - c.left + container.scrollLeft,
      right: r.right - c.left + container.scrollLeft,
      midY: r.top - c.top + container.scrollTop + r.height / 2,
    });
    const bars = new Map<string, ReturnType<typeof toContent>>();
    container.querySelectorAll<HTMLElement>('[data-bar-task-id]').forEach((el) => {
      bars.set(el.dataset.barTaskId!, toContent(el.getBoundingClientRect()));
    });
    const next: Line[] = [];
    for (const task of timeline.projects.flatMap((p) => p.tasks)) {
      for (const dep of task.dependsOn ?? []) {
        const from = bars.get(dep.taskId);
        const to = bars.get(task.id);
        if (!from || !to) continue;
        next.push({ childId: task.id, parentId: dep.taskId, follow: dep.follow, d: elbowPath(from.right, from.midY, to.left, to.midY) });
      }
    }
    // Text edits re-run this too; only update state when a line actually changed.
    setLines((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    setSize((prev) =>
      prev.w === container.scrollWidth && prev.h === container.scrollHeight ? prev : { w: container.scrollWidth, h: container.scrollHeight }
    );
    // A link removed elsewhere (row panel, undo) closes its panel so it can't pop back on redo.
    setOpen((o) => (o && next.some((l) => l.childId === o.childId && l.parentId === o.parentId) ? o : null));
  }, [containerRef, timeline]);

  // Re-measure after every timeline change (dates, links, expand/collapse) and on resize.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [measure]);

  useEffect(() => {
    const container = containerRef.current;
    const table = container?.querySelector('table');
    if (!container || !table) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(table);
    return () => ro.disconnect();
  }, [containerRef, measure]);

  if (!timeline) return null;
  const names = new Map(timeline.projects.flatMap((p) => p.tasks).map((t) => [t.id, t.name]));
  const current = open && lines.find((l) => l.childId === open.childId && l.parentId === open.parentId);

  return (
    <>
      <svg
        className="pointer-events-none absolute left-0 top-0 z-1 text-muted-foreground"
        width={size.w}
        height={size.h}
        aria-hidden="true"
        data-dependency-lines
      >
        <defs>
          <marker id="dep-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
          </marker>
        </defs>
        {dragPath && (
          <path d={dragPath} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#dep-arrow)" data-link-drag-line />
        )}
        {lines.map((l) => (
          <g key={`${l.parentId}>${l.childId}`} data-link={`${l.parentId}>${l.childId}`}>
            <path
              d={l.d}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.75}
              strokeWidth={1.25}
              strokeDasharray={l.follow ? undefined : '4 3'}
              markerEnd="url(#dep-arrow)"
            />
            {/* Wide invisible stroke so the line is easy to click. */}
            <path
              d={l.d}
              fill="none"
              stroke="transparent"
              strokeWidth={10}
              className="cursor-pointer"
              style={{ pointerEvents: 'stroke' }}
              onClick={(e) => {
                const container = containerRef.current!;
                const c = container.getBoundingClientRect();
                setOpen({
                  childId: l.childId,
                  parentId: l.parentId,
                  x: e.clientX - c.left + container.scrollLeft,
                  y: e.clientY - c.top + container.scrollTop,
                });
              }}
            />
          </g>
        ))}
      </svg>
      {open && current && (
        <LinkPopover
          x={open.x}
          y={open.y}
          childName={names.get(open.childId) ?? ''}
          parentName={names.get(open.parentId) ?? ''}
          childId={open.childId}
          parentId={open.parentId}
          follow={current.follow}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

interface LinkPopoverProps {
  x: number;
  y: number;
  childId: string;
  parentId: string;
  childName: string;
  parentName: string;
  follow: boolean;
  onClose: () => void;
}

/** Small panel at the click point: follow switch + remove. Closes on outside click or Esc. */
function LinkPopover({ x, y, childId, parentId, childName, parentName, follow, onClose }: LinkPopoverProps) {
  const setDependencyFollow = useTimelineStore((s) => s.setDependencyFollow);
  const removeDependency = useTimelineStore((s) => s.removeDependency);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); // this Esc closes the panel; don't also clear the task selection
      onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest('[data-link-popover]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={`Link from ${parentName} to ${childName}`}
      data-link-popover
      data-slot="popover-content"
      data-open=""
      className="absolute z-30 w-64 rounded-lg bg-popover p-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left: x + 6, top: y + 6 }}
    >
      <p className="mb-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{childName}</span> follows{' '}
        <span className="font-medium text-foreground">{parentName}</span>
      </p>
      <label className="flex cursor-pointer items-center gap-2 py-1">
        <Checkbox checked={follow} onCheckedChange={(v) => setDependencyFollow(childId, parentId, v === true)} />
        Move with {parentName}
      </label>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 w-full justify-start text-destructive"
        onClick={() => {
          removeDependency(childId, parentId);
          onClose();
        }}
      >
        <Trash2 data-icon="inline-start" />
        Remove link
      </Button>
    </div>
  );
}
