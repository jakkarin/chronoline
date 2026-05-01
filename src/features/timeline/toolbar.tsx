import { useRef, useState } from 'react';
import {
  Plus, Undo2, Redo2, CalendarDays, Download, Upload, Presentation,
  ArrowDown, ArrowUpDown, PanelLeftClose, PanelLeft, BookmarkPlus, History,
} from 'lucide-react';
import { useStore } from 'zustand';
import { useTimelineStore } from '@/store/timeline-store';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { HolidaysSheet } from './holidays-sheet';
import { SaveVersionDialog } from './save-version-dialog';
import { VersionHistorySheet } from './version-history-sheet';
import { exportJSON } from '@/features/io/export-json';
import { parseImportJSON } from '@/features/io/import-json';
import { generatePresentHTML } from '@/features/io/export-pdf';
import { PresentOverlay } from './present-overlay';
import { ReorderDialog } from './reorder-dialog';
import { timelineRepo } from '@/lib/db/timelines';
import { toast } from 'sonner';

interface ToolbarProps {
  freezeColumns: boolean;
  onToggleFreeze: () => void;
}

export function Toolbar({ freezeColumns, onToggleFreeze }: ToolbarProps) {
  const addProject = useTimelineStore((s) => s.addProject);
  const timeline = useTimelineStore((s) => s.timeline);
  const setTimeline = useTimelineStore((s) => s.setTimeline);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [presentHtml, setPresentHtml] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { undo, redo, pastStates, futureStates } = useStore(
    useTimelineStore.temporal,
    (s) => s
  );
  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  function scrollToToday() {
    const el = document.querySelector('[data-today-col]') as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  async function handleSaveJSON() {
    if (!timeline) return;
    exportJSON(timeline);
  }

  async function handleLoadJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !timeline) return;
    const raw = await file.text();
    try {
      const parsed = parseImportJSON(raw);
      const choice = window.confirm(
        'Replace current timeline?\n\nOK = Replace current\nCancel = Import as new timeline'
      );
      if (choice) {
        await timelineRepo.update(timeline.id, { ...parsed, id: timeline.id });
        const updated = await timelineRepo.get(timeline.id);
        if (updated) setTimeline(updated);
      } else {
        await timelineRepo.create(parsed);
        toast.success('Imported as new timeline');
      }
    } catch (err) {
      toast.error('Import failed: ' + (err as Error).message);
    }
    e.target.value = '';
  }

  function handlePresent() {
    if (!timeline) return;
    try {
      setPresentHtml(generatePresentHTML(timeline.title, timeline));
    } catch (err) {
      toast.error('Present failed: ' + (err as Error).message);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-background shrink-0 flex-wrap" data-pdf-hide>
        <Button size="sm" onClick={addProject} className="h-7 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Group
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setReorderOpen(true)}
          disabled={!timeline}
          title="Reorder groups and tasks in a list view"
        >
          <ArrowUpDown className="h-3.5 w-3.5" /> Reorder
        </Button>

        <Separator orientation="vertical" className="h-5" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => undo()}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Cmd+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => redo()}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-5" />

        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={scrollToToday}>
          <ArrowDown className="h-3.5 w-3.5" /> Today
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setHolidaysOpen(true)}>
          <CalendarDays className="h-3.5 w-3.5" /> Holidays
        </Button>
        <Button
          variant={freezeColumns ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={onToggleFreeze}
          title="Freeze left columns"
        >
          {freezeColumns ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
          Freeze
        </Button>

        <Separator orientation="vertical" className="h-5" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setSaveVersionOpen(true)}
          disabled={!timeline}
          title="Save a named version of this timeline"
        >
          <BookmarkPlus className="h-3.5 w-3.5" /> Save Version
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setHistoryOpen(true)}
          disabled={!timeline}
          title="View version history"
        >
          <History className="h-3.5 w-3.5" /> History
        </Button>

        <Separator orientation="vertical" className="h-5" />

        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={handleSaveJSON}>
          <Download className="h-3.5 w-3.5" /> Save JSON
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Load JSON
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={handlePresent}
        >
          <Presentation className="h-3.5 w-3.5" />
          Present
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleLoadJSON}
        />
      </div>

      <HolidaysSheet open={holidaysOpen} onOpenChange={setHolidaysOpen} />
      {reorderOpen && <ReorderDialog open={reorderOpen} onOpenChange={setReorderOpen} />}
      <SaveVersionDialog open={saveVersionOpen} onOpenChange={setSaveVersionOpen} />
      <VersionHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />
      {presentHtml && <PresentOverlay html={presentHtml} title={timeline?.title ?? ''} onClose={() => setPresentHtml(null)} />}
    </>
  );
}
