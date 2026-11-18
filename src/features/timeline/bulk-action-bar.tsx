import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { useTimelineStore } from '@/store/timeline-store';
import { selectExistingIds, useTaskSelectionStore } from '@/store/selection-store';

/** Floating bar shown while tasks are ticked: set one start date on all of them. */
export function BulkActionBar() {
  const timeline = useTimelineStore((s) => s.timeline);
  const setTasksStartDate = useTimelineStore((s) => s.setTasksStartDate);
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds);
  const clear = useTaskSelectionStore((s) => s.clear);

  const ids = selectExistingIds(selectedIds, timeline);
  const countLabel = `${ids.length} ${ids.length === 1 ? 'task' : 'tasks'} selected`;

  return (
    <>
      {/* Always mounted so screen readers announce the bar appearing and the count changing. */}
      <div className="sr-only" aria-live="polite" data-bulk-selection-status>
        {ids.length > 0 ? countLabel : ''}
      </div>
      {ids.length > 0 && (
        <div
          role="region"
          aria-label="Bulk edit selected tasks"
          className="fixed bottom-10 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
          data-pdf-hide
        >
          <span className="whitespace-nowrap font-medium">{countLabel}</span>
          <DatePicker
            value=""
            placeholder="Start date"
            onChange={(date) => setTasksStartDate(ids, date)}
            className="w-auto border border-border"
          />
          <Button variant="ghost" size="sm" onClick={clear} aria-label="Clear selection">
            <X data-icon="inline-start" />
            Clear
          </Button>
        </div>
      )}
    </>
  );
}
