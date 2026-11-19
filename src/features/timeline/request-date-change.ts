import { useTimelineStore } from '@/store/timeline-store';
import { useDateChangePrompt } from '@/store/date-change-prompt';
import type { DateEdit } from '@/store/date-change';

/**
 * Change task dates from the UI. Applies straight away when everything still fits the
 * timeline; otherwise opens the "Extend timeline?" dialog and applies on the user's choice.
 */
export function requestDateChange(edit: DateEdit, onCancel?: () => void): void {
  const info = useTimelineStore.getState().commitDateChange(edit);
  if (info) useDateChangePrompt.getState().open({ edit, info, onCancel });
}
