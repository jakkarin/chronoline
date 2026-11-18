import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTimelineStore } from '@/store/timeline-store';
import { useTimeline } from '@/hooks/use-timeline';
import { useAutosave } from '@/hooks/use-autosave';
import { EditorHeader } from '@/features/timeline/editor-header';
import { Toolbar } from '@/features/timeline/toolbar';
import { TimelineTable } from '@/features/timeline/timeline-table';
import { BulkActionBar } from '@/features/timeline/bulk-action-bar';
import { useTaskSelectionStore } from '@/store/selection-store';
import { Button } from '@/components/ui/button';
import { getTimelineAdapter, saveTimelineForSession } from '@/lib/timeline-adapters';

export default function TimelineEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loading, notFound } = useTimeline(id);
  const saveStatus = useTimelineStore((s) => s.saveStatus);
  const editorSession = useTimelineStore((s) => s.editorSession);
  const adapter = editorSession ? getTimelineAdapter(editorSession) : null;
  const [freezeColumns, setFreezeColumns] = useState(false);

  useAutosave();

  // Task selection is per-timeline UI state: drop it when leaving or switching timelines.
  useEffect(() => () => useTaskSelectionStore.getState().clear(), [id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isEscapeHandledElsewhere(e)) {
        useTaskSelectionStore.getState().clear();
      }
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
        const state = useTimelineStore.getState();
        if (!state.timeline || !state.editorSession) return;
        const timeline = state.timeline;
        const session = state.editorSession;

        void (async () => {
          state.setSaveStatus('saving');
          try {
            const nextSession = await saveTimelineForSession(timeline, session);
            state.setEditorSession(nextSession);
            state.setSaveStatus('saved');
          } catch {
            state.setSaveStatus('error');
          }
        })();
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
      <BulkActionBar />
      <footer className="shrink-0 border-t border-border bg-background px-4 py-1.5 flex gap-4 text-[11px] text-muted-foreground font-mono" data-pdf-hide>
        <span>💡 Click cells to edit</span>
        <span>·</span>
        <span>Drag bar to move / resize</span>
        <span>·</span>
        <span>Use Reorder in the toolbar to arrange groups and tasks</span>
        <span>·</span>
        <span><kbd className="bg-muted border border-border rounded px-1 py-0.5 text-[9px]">⌘Z</kbd> Undo</span>
        <span>·</span>
        <span><kbd className="bg-muted border border-border rounded px-1 py-0.5 text-[9px]">⌘S</kbd> {adapter?.saveActionLabel ?? 'Save'}</span>
      </footer>
    </div>
  );
}

/** Esc belongs to an input being edited or an open popover before it clears the task selection. */
function isEscapeHandledElsewhere(e: KeyboardEvent): boolean {
  if (e.defaultPrevented) return true;
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return true;
  if (active instanceof HTMLElement && active.isContentEditable) return true;
  return document.querySelector('[data-slot="popover-content"][data-open]') !== null;
}
