import { create } from 'zustand';
import type { DateEdit, OverflowInfo } from '@/store/date-change';

/** A date change waiting for the user's "extend the timeline?" answer. Transient UI state. */
export interface PendingDateChange {
  edit: DateEdit;
  info: OverflowInfo;
  /** Called when the user picks "Cancel change". */
  onCancel?: () => void;
}

interface DateChangePromptStore {
  pending: PendingDateChange | null;
  open: (pending: PendingDateChange) => void;
  close: () => void;
}

export const useDateChangePrompt = create<DateChangePromptStore>()((set) => ({
  pending: null,
  open: (pending) => set({ pending }),
  close: () => set({ pending: null }),
}));
