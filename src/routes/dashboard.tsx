import { useEffect, useState, useMemo } from 'react';
import { CalendarDays, FolderOpen, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { timelineRepo } from '@/lib/db/timelines';
import { seedDemoDataIfEmpty } from '@/lib/db/seed';
import type { TimelineMeta } from '@/lib/types';
import { HolidayPresetDialog } from '@/features/dashboard/holiday-preset-dialog';
import { TimelineCard } from '@/features/dashboard/timeline-card';
import { EmptyState } from '@/features/dashboard/empty-state';
import { NewTimelineDialog } from '@/features/dashboard/new-timeline-dialog';
import { TermsPrivacyModal } from '@/components/terms-privacy-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { useRecentTaskColors } from '@/hooks/use-recent-task-colors';
import { pickTimelineFileForDirectEdit, supportsFileSystemAccess } from '@/lib/timeline-file';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { loadHolidayPresets, persistHolidayPresets } from '@/lib/holiday-preset';

type SortKey = 'updatedAt' | 'createdAt' | 'title';

export default function Dashboard() {
  const navigate = useNavigate();
  const [timelines, setTimelines] = useState<TimelineMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('updatedAt');
  const [newOpen, setNewOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  const [holidayPresets, setHolidayPresets] = useState(() => loadHolidayPresets());
  const [holidayPresetDrafts, setHolidayPresetDrafts] = useState(() => loadHolidayPresets());
  const [selectedHolidayPresetId, setSelectedHolidayPresetId] = useState<string | null>(null);
  const [selectedNewHolidayPresetId, setSelectedNewHolidayPresetId] = useState('none');
  const { syncFromTimelines } = useRecentTaskColors();

  const canDirectEdit = supportsFileSystemAccess();

  async function loadTimelineListAndSyncRecentColors() {
    await seedDemoDataIfEmpty();
    const list = await timelineRepo.list();
    const timelines = await Promise.all(list.map((meta) => timelineRepo.get(meta.id)));
    syncFromTimelines(timelines);
    return list;
  }

  async function load(showLoadingState = true) {
    if (showLoadingState) {
      setLoading(true);
    }

    const list = await loadTimelineListAndSyncRecentColors();

    setTimelines(list);
    setLoading(false);
  }

  async function handleOpenJSON() {
    if (!canDirectEdit || openingFile) return;

    setOpeningFile(true);
    try {
      const directEdit = await pickTimelineFileForDirectEdit();
      navigate('/timeline/direct', { state: { directEdit } });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('Open JSON failed: ' + (err as Error).message);
      }
    } finally {
      setOpeningFile(false);
    }
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      const list = await loadTimelineListAndSyncRecentColors();

      if (!active) return;

      setTimelines(list);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [syncFromTimelines]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = timelines.filter(
      (t) =>
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q)
    );
    if (sort === 'title') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'createdAt') {
      list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    }
    return list;
  }, [timelines, search, sort]);

  function handleSaveHolidayPresets(presets: Parameters<typeof persistHolidayPresets>[0]) {
    const nextPresets = persistHolidayPresets(presets);
    setHolidayPresets(nextPresets);
    setHolidayPresetDrafts(nextPresets);

    if (!nextPresets.some((preset) => preset.id === selectedNewHolidayPresetId)) {
      setSelectedNewHolidayPresetId('none');
    }

    if (!nextPresets.some((preset) => preset.id === selectedHolidayPresetId)) {
      setSelectedHolidayPresetId(nextPresets[0]?.id ?? null);
    }
  }

  function handleOpenPresetDialog() {
    setHolidayPresetDrafts(holidayPresets);
    setSelectedHolidayPresetId(holidayPresets[0]?.id ?? null);
    setPresetOpen(true);
  }

  function handleOpenNewTimelineDialog() {
    setSelectedNewHolidayPresetId(holidayPresets[0]?.id ?? 'none');
    setNewOpen(true);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 bg-foreground rounded rotate-45 shrink-0" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
            Chronoline
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button size="sm" variant="outline" onClick={handleOpenPresetDialog} className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Holiday Presets
            {holidayPresets.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                {holidayPresets.length}
              </span>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenJSON}
            disabled={!canDirectEdit || openingFile}
            className="gap-1.5"
            title={canDirectEdit ? 'Open a JSON file for direct editing' : 'Direct file editing is not supported in this browser'}
          >
            <FolderOpen className="h-4 w-4" />
            Open JSON
          </Button>
          <Button size="sm" onClick={handleOpenNewTimelineDialog} className="gap-1.5">
            + New Timeline
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-6 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search timelines…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">Recently updated</SelectItem>
              <SelectItem value="createdAt">Recently created</SelectItem>
              <SelectItem value="title">Title A→Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : filtered.length === 0 && !search ? (
          <EmptyState onNew={handleOpenNewTimelineDialog} />
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            No timelines match &ldquo;{search}&rdquo;
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((meta) => (
              <TimelineCard key={meta.id} meta={meta} onRefresh={load} />
            ))}
          </div>
        )}
      </main>

      <NewTimelineDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={load}
        holidayPresets={holidayPresets}
        selectedHolidayPresetId={selectedNewHolidayPresetId}
        onSelectedHolidayPresetIdChange={setSelectedNewHolidayPresetId}
      />
      <HolidayPresetDialog
        open={presetOpen}
        onOpenChange={setPresetOpen}
        presets={holidayPresetDrafts}
        selectedPresetId={selectedHolidayPresetId}
        onSelectedPresetIdChange={setSelectedHolidayPresetId}
        onPresetsChange={setHolidayPresetDrafts}
        onSave={handleSaveHolidayPresets}
      />

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Your data stays local on your device. No account needed.
          </p>
          <button
            onClick={() => setTermsOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Terms & Privacy Policy
          </button>
        </div>
      </footer>

      <TermsPrivacyModal open={termsOpen} onOpenChange={setTermsOpen} showTrigger={false} />
    </div>
  );
}
