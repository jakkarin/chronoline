import { useEffect, useState, useMemo } from 'react';
import { FolderOpen, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { timelineRepo } from '@/lib/db/timelines';
import { seedDemoDataIfEmpty } from '@/lib/db/seed';
import type { TimelineMeta } from '@/lib/types';
import { TimelineCard } from '@/features/dashboard/timeline-card';
import { EmptyState } from '@/features/dashboard/empty-state';
import { NewTimelineDialog } from '@/features/dashboard/new-timeline-dialog';
import { TermsPrivacyModal } from '@/components/terms-privacy-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { pickTimelineFileForDirectEdit, supportsFileSystemAccess } from '@/lib/timeline-file';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SortKey = 'updatedAt' | 'createdAt' | 'title';

export default function Dashboard() {
  const navigate = useNavigate();
  const [timelines, setTimelines] = useState<TimelineMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('updatedAt');
  const [newOpen, setNewOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);

  const canDirectEdit = supportsFileSystemAccess();

  async function load() {
    setLoading(true);
    await seedDemoDataIfEmpty();
    const list = await timelineRepo.list();
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

  useEffect(() => { load(); }, []);

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
          <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
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
          <EmptyState onNew={() => setNewOpen(true)} />
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

      <NewTimelineDialog open={newOpen} onOpenChange={setNewOpen} onCreated={load} />

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Your data stays in your browser. No account needed.
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
