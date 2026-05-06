import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useTimelineStore } from '@/store/timeline-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeferredInput } from '@/components/deferred-input';
import { ThemeToggle } from '@/components/theme-toggle';

export function EditorHeader() {
  const navigate = useNavigate();
  const timeline = useTimelineStore((s) => s.timeline);
  const editorSession = useTimelineStore((s) => s.editorSession);
  const saveStatus = useTimelineStore((s) => s.saveStatus);
  const setMeta = useTimelineStore((s) => s.setMeta);

  if (!timeline) return null;

  return (
    <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-background shrink-0">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Back to dashboard"
        onClick={() => navigate('/')}
        className="shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-3">
        <DeferredInput
          className="h-8 text-sm font-semibold max-w-56 rounded-lg border border-input bg-transparent px-2.5 py-1 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={timeline.title}
          onCommit={(v) => setMeta({ title: v })}
          aria-label="Timeline title"
        />
        {editorSession?.mode === 'file' && (
          <span className="inline-flex h-6 items-center rounded-full border border-border bg-muted px-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Direct Edit · {editorSession.fileName}
          </span>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="uppercase font-semibold tracking-wide text-[10px]">Customer</span>
            <DeferredInput
              className="h-6 text-xs w-28 rounded-lg border border-input bg-transparent px-2.5 py-1 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={timeline.customer}
              onCommit={(v) => setMeta({ customer: v })}
              placeholder="—"
              aria-label="Customer"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="uppercase font-semibold tracking-wide text-[10px]">Start</span>
            <input
              type="date"
              className="h-6 text-xs font-mono border border-input rounded px-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={timeline.startDate}
              onChange={(e) => setMeta({ startDate: e.target.value })}
              aria-label="Start date"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="uppercase font-semibold tracking-wide text-[10px]">Weeks</span>
            <Input
              type="number"
              min={1}
              max={52}
              className="h-6 text-xs w-14 font-mono"
              value={timeline.weeks}
              onChange={(e) => setMeta({ weeks: Math.max(1, Math.min(52, Number(e.target.value))) })}
              aria-label="Span weeks"
            />
          </div>
          {timeline.note !== undefined && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="uppercase font-semibold tracking-wide text-[10px]">Note</span>
              <DeferredInput
                className="h-6 text-xs w-28 rounded-lg border border-input bg-transparent px-2.5 py-1 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={timeline.note}
                onCommit={(v) => setMeta({ note: v })}
                placeholder="—"
                aria-label="Note"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <SaveStatusIndicator status={saveStatus} />
        <ThemeToggle />
      </div>
    </header>
  );
}

function SaveStatusIndicator({ status }: { status: string }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
        <CheckCircle2 className="h-3 w-3 text-green-500" />
        Saved {format(new Date(), 'HH:mm')}
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive font-mono">
        <AlertCircle className="h-3 w-3" /> Save error
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground font-mono">Ready</span>;
}
