import { useRef, useCallback, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { LINK_REJECTION_MESSAGE } from '@/lib/dependencies';
import { resolveTaskBarColor } from '@/lib/task-colors';
import { useLinkDrag } from '@/store/link-drag';
import { useTimelineStore } from '@/store/timeline-store';
import type { Priority, TaskColor } from '@/lib/types';

const CELL_WIDTH = 32;

interface GanttBarProps {
  startCol: number;
  endCol: number;
  totalCols: number;
  priority: Priority;
  taskColor?: TaskColor | null;
  label: string;
  percent?: number;
  isProject?: boolean;
  /** Set on task bars so link lines and link-drag can find them. */
  taskId?: string;
  onUpdate?: (newStart: number, newEnd: number) => void;
}

export function GanttBar({
  startCol,
  endCol,
  totalCols,
  priority,
  taskColor,
  label,
  percent = 0,
  isProject = false,
  taskId,
  onUpdate,
}: GanttBarProps) {
  const dragRef = useRef<{
    mode: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    origStart: number;
    origEnd: number;
    lastNs: number;
    lastNe: number;
  } | null>(null);

  const barRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(false);

  const span = endCol - startCol + 1;
  const barColor = isProject
    ? 'transparent'
    : resolveTaskBarColor(taskColor, priority);

  // Dismiss when clicking outside
  useEffect(() => {
    if (!selected) return;
    const onOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (barRef.current && !barRef.current.contains(target) && !dotRef.current?.contains(target)) {
        setSelected(false);
      }
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [selected]);

  const startDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, mode: 'move' | 'resize-left' | 'resize-right') => {
      if (isProject || !onUpdate) return;
      e.preventDefault();
      e.stopPropagation();
      barRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = { mode, startX: e.clientX, origStart: startCol, origEnd: endCol, lastNs: startCol, lastNe: endCol };
    },
    [isProject, onUpdate, startCol, endCol]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !barRef.current) return;
      const { mode, startX, origStart, origEnd } = dragRef.current;
      const delta = Math.round((e.clientX - startX) / CELL_WIDTH);

      let ns = origStart;
      let ne = origEnd;
      if (mode === 'move') {
        const span2 = origEnd - origStart;
        ns = Math.min(origStart + delta, totalCols - 1 - span2);
        ne = ns + span2;
      } else if (mode === 'resize-left') {
        ns = Math.min(origStart + delta, origEnd);
      } else {
        ne = Math.max(origStart, Math.min(origEnd + delta, totalCols - 1));
      }

      const newSpan = ne - ns + 1;
      barRef.current.style.left = `${ns * CELL_WIDTH + 2}px`;
      barRef.current.style.width = `${newSpan * CELL_WIDTH - 4}px`;
      dragRef.current.lastNs = ns;
      dragRef.current.lastNe = ne;
    },
    [totalCols]
  );

  const commitDrag = useCallback(
    () => {
      if (!dragRef.current || !barRef.current || !onUpdate) return;
      const { origStart, origEnd, lastNs, lastNe } = dragRef.current;
      dragRef.current = null;
      // Put the bar back where its props say. If the change applies, new props move it;
      // if it waits for (or is cancelled in) the "Extend timeline?" dialog, it stays put.
      barRef.current.style.left = `${startCol * CELL_WIDTH + 2}px`;
      barRef.current.style.width = `${(endCol - startCol + 1) * CELL_WIDTH - 4}px`;
      if (lastNs !== origStart || lastNe !== origEnd) onUpdate(lastNs, lastNe);
    },
    [onUpdate, startCol, endCol]
  );

  const handlePointerUp = useCallback(() => commitDrag(), [commitDrag]);

  const handlePointerCancel = useCallback(() => commitDrag(), [commitDrag]);

  // Drag from the dot onto another bar to make that task follow this one.
  const onDotDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!taskId) return;
    e.preventDefault();
    e.stopPropagation();
    dotRef.current?.setPointerCapture(e.pointerId);
    useLinkDrag.getState().set({ fromTaskId: taskId, x: e.clientX, y: e.clientY });
  };
  const onDotMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = useLinkDrag.getState().drag;
    if (drag) useLinkDrag.getState().set({ ...drag, x: e.clientX, y: e.clientY });
  };
  const onDotUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = useLinkDrag.getState().drag;
    useLinkDrag.getState().set(null);
    if (!drag) return;
    const targetId = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-bar-task-id]')?.dataset.barTaskId;
    if (!targetId || targetId === drag.fromTaskId) return;
    const result = useTimelineStore.getState().addDependency(targetId, drag.fromTaskId);
    if (!result.ok) toast.error(LINK_REJECTION_MESSAGE[result.reason]);
  };

  const showDot = selected && !isProject && !!taskId;

  return (
    <>
    {showDot && (
      <div
        ref={dotRef}
        role="button"
        aria-label="Drag to link a task that follows this one"
        title="Drag onto another bar to link"
        data-link-dot
        onPointerDown={onDotDown}
        onPointerMove={onDotMove}
        onPointerUp={onDotUp}
        onPointerCancel={() => useLinkDrag.getState().set(null)}
        style={{
          position: 'absolute',
          top: '50%',
          left: `${(startCol + span) * CELL_WIDTH - 1}px`,
          width: 10,
          height: 10,
          transform: 'translateY(-50%)',
          borderRadius: 9999,
          background: 'var(--color-background)',
          border: '2px solid var(--color-foreground)',
          cursor: 'crosshair',
          zIndex: 3,
          touchAction: 'none',
        }}
      />
    )}
    <div
      ref={barRef}
      data-bar-task-id={taskId}
      onClick={() => { if (!isProject && onUpdate) setSelected(true); }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      title={label}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        left: `${startCol * CELL_WIDTH + 2}px`,
        width: `${span * CELL_WIDTH - 4}px`,
        height: isProject ? '10px' : '16px',
        background: isProject ? 'transparent' : barColor,
        border: isProject
          ? '1px solid currentColor'
          : selected ? `2px solid white` : 'none',
        borderRadius: '3px',
        zIndex: selected ? 2 : 1,
        userSelect: 'none',
        boxShadow: isProject ? 'none' : selected
          ? '0 0 0 2px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)'
          : '0 1px 2px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
        cursor: isProject ? 'default' : selected ? 'default' : 'pointer',
        touchAction: 'none',
      }}
    >
      {!isProject && selected && (
        <>
          {/* Left resize handle */}
          <div
            onPointerDown={(e) => startDrag(e, 'resize-left')}
            style={{
              width: 10, flexShrink: 0, zIndex: 2, cursor: 'ew-resize',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.25)',
            }}
          >
            <div style={{ width: 2, height: 10, borderRadius: 1, background: 'rgba(255,255,255,0.8)' }} />
          </div>

          {/* Center drag handle */}
          <div
            onPointerDown={(e) => startDrag(e, 'move')}
            style={{ flex: 1, cursor: 'grab', display: 'flex', alignItems: 'center', overflow: 'hidden', zIndex: 2 }}
          >
            {percent > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: 0, top: 0, bottom: 0,
                  width: `${percent}%`,
                  background: 'rgba(0,0,0,0.25)',
                  borderRadius: '3px 0 0 3px',
                  pointerEvents: 'none',
                }}
              />
            )}
            <span style={{ position:'relative', zIndex:1, fontSize:'9px', fontWeight:500, color:'white', padding:'0 2px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
              {label}
            </span>
          </div>

          {/* Right resize handle */}
          <div
            onPointerDown={(e) => startDrag(e, 'resize-right')}
            style={{
              width: 10, flexShrink: 0, zIndex: 2, cursor: 'ew-resize',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.25)',
            }}
          >
            <div style={{ width: 2, height: 10, borderRadius: 1, background: 'rgba(255,255,255,0.8)' }} />
          </div>
        </>
      )}

      {!isProject && !selected && (
        <span style={{ position:'absolute', inset:0, zIndex:1, fontSize:'9px', fontWeight:500, color:'white', padding:'0 4px', display:'flex', alignItems:'center', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', pointerEvents:'none' }}>
          {label}
        </span>
      )}

      {isProject && (
        <span style={{ position:'absolute', inset:0, fontSize:'9px', fontWeight:500, color:'currentColor', padding:'0 4px', display:'flex', alignItems:'center', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
          {label}
        </span>
      )}
    </div>
    </>
  );
}
