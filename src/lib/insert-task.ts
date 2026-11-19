import type { Timeline } from '@/lib/types';

/** What the Insert task dialog collects. */
export interface InsertInput {
  projectId: string;
  name: string;
  owner: string;
  startDate: string;
  endDate: string;
  followsTaskId: string | null;
}

/** Apply an insert (new task + chosen shifts + cascade) to an Immer draft. Implemented in the Insert task step. */
export function applyInsertToDraft(
  draft: Timeline,
  input: InsertInput,
  ticked: ReadonlySet<string>,
  unticked: ReadonlySet<string>
): void {
  void [draft, input, ticked, unticked];
  throw new Error('Insert task is not implemented yet');
}
