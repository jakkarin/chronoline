import { useRef, useCallback, useState, useEffect } from 'react';
import type { Priority } from '@/lib/types';

export const PRIORITY_BAR_COLOR: Record<string, string> = {
  HIGHEST: '#dc2626',
  HIGH:    '#ea580c',
  MED:     '#ca8a04',
  LOW:     '#0891b2',
  LOWEST:  '#78716c',
  NONE:    '#78716c',
};

const CELL_WIDTH = 32;

interface GanttBarProps {
  startCol: number;
  endCol: number;
  totalCols: number;
  priority: Priority;
  label: string;
  percent?: number;
  isProject?: boolean;
  onUpdate?: (newStart: number, newEnd: number) => void;
}

export function GanttBar({
  startCol,
  endCol,
  totalCols,
  priority,
  label,
  percent = 0,
  isProject = false,
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
  const [selected, setSelected] = useState(false);

  const span = endCol - startCol + 1;
  const barColor = isProject
    ? 'transparent'
    : (PRIORITY_BAR_COLOR[priority ?? 'NONE'] ?? '#78716c');

  // Dismiss when clicking outside
  useEffect(() => {
    if (!selected) return;
    const onOutside = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
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
    (_clientX: number) => {
      if (!dragRef.current || !barRef.current || !onUpdate) return;
      const { origStart, origEnd, lastNs, lastNe } = dragRef.current;
      dragRef.current = null;
      if (lastNs !== origStart || lastNe !== origEnd) onUpdate(lastNs, lastNe);
    },
    [onUpdate]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => commitDrag(e.clientX),
    [commitDrag]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => commitDrag(e.clientX),
    [commitDrag]
  );

  return (
    <div
      ref={barRef}
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
  );
}
