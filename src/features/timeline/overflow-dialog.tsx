import { format, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { MAX_WEEKS } from '@/lib/timeline-overflow';
import { useDateChangePrompt } from '@/store/date-change-prompt';
import { useTimelineStore } from '@/store/timeline-store';
import type { OverflowChoice } from '@/store/date-change';

const short = (date: string) => format(parseISO(date), 'd MMM');

/** "Extend timeline?" — shown when a date change would push tasks past the last week. */
export function OverflowDialog() {
  const pending = useDateChangePrompt((s) => s.pending);
  const close = useDateChangePrompt((s) => s.close);
  const timeline = useTimelineStore((s) => s.timeline);
  const commitDateChange = useTimelineStore((s) => s.commitDateChange);

  if (!pending || !timeline) return null;
  const { info, edit, onCancel } = pending;
  const names = new Map(timeline.projects.flatMap((p) => p.tasks).map((t) => [t.id, t.name]));
  const edge = info.edgePreview[0]?.dates.endDate;
  const count = info.taskIds.length;

  const cancel = () => {
    close();
    onCancel?.();
  };
  const choose = (choice: OverflowChoice) => {
    close();
    commitDateChange(edit, choice);
  };

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) cancel(); }}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Extend timeline?</AlertDialogTitle>
          <AlertDialogDescription>
            This change pushes {count} {count === 1 ? 'task' : 'tasks'} past the last week. Extend the
            timeline from {info.fromWeeks} to {info.toWeeks} weeks?
          </AlertDialogDescription>
        </AlertDialogHeader>
        {info.beyondCap && (
          <p className="text-sm text-destructive">
            {MAX_WEEKS} weeks is the maximum; tasks beyond it will stop at the edge.
          </p>
        )}
        {edge && (
          <div className="text-sm">
            <p className="text-muted-foreground">
              If not extended, these stop at the edge ({short(edge)}), keep their length, and may overlap
              other tasks:
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
              {info.edgePreview.map(({ taskId, dates }) => (
                <li key={taskId} className="flex justify-between gap-4">
                  <span className="truncate">{names.get(taskId) ?? taskId}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {short(dates.startDate)} – {short(dates.endDate)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <AlertDialogFooter>
          <Button variant="ghost" onClick={cancel}>Cancel change</Button>
          <Button variant="outline" onClick={() => choose('stopAtEdge')}>Don't extend (stop at edge)</Button>
          <Button onClick={() => choose('extend')}>Extend</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
