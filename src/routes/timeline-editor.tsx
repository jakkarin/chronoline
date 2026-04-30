import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTimelineStore } from '@/store/timeline-store';
import { useTimeline } from '@/hooks/use-timeline';
import { useAutosave } from '@/hooks/use-autosave';
import { EditorHeader } from '@/features/timeline/editor-header';
import { Toolbar } from '@/features/timeline/toolbar';
import { TimelineTable } from '@/features/timeline/timeline-table';
import { Button } from '@/components/ui/button';

export default function TimelineEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loading, notFound } = useTimeline(id);
  const saveStatus = useTimelineStore((s) => s.saveStatus);
  const [freezeColumns, setFreezeColumns] = useState(false);

  useAutosave();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useTimelineStore.temporal.getState().undo();
      }
      if (mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        useTimelineStore.temporal.getState().redo();
      }
      if (mod && e.key === 's') {
        e.preventDefault();
        const tl = useTimelineStore.getState().timeline;
        if (tl) {
          import('@/features/io/export-json').then(({ exportJSON }) => exportJSON(tl));
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === 'saving') {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
        Loading timeline…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-lg font-semibold">Timeline not found</p>
        <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="timeline-editor-root flex flex-col h-screen overflow-hidden bg-background">
      <EditorHeader />
      <Toolbar freezeColumns={freezeColumns} onToggleFreeze={() => setFreezeColumns(f => !f)} />
      <TimelineTable freeze={freezeColumns} />
      <footer className="shrink-0 border-t border-border bg-background px-4 py-1.5 flex gap-4 text-[11px] text-muted-foreground font-mono" data-pdf-hide>
        <span>💡 Click cells to edit</span>
        <span>·</span>
        <span>Drag bar to move / resize</span>
        <span>·</span>
        <span>Drag <kbd className="bg-muted border border-border rounded px-1 py-0.5 text-[9px]">⠿</kbd> handle to reorder rows</span>
        <span>·</span>
        <span><kbd className="bg-muted border border-border rounded px-1 py-0.5 text-[9px]">⌘Z</kbd> Undo</span>
        <span>·</span>
        <span><kbd className="bg-muted border border-border rounded px-1 py-0.5 text-[9px]">⌘S</kbd> Save JSON</span>
      </footer>
    </div>
  );
}
