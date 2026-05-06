import { versionsRepo } from '@/lib/db/versions';
import type { Timeline, TimelineVersion } from '@/lib/types';
import { downloadTimelineJSON } from '@/lib/timeline-json';

export async function exportJSON(timeline: Timeline, versions?: TimelineVersion[]) {
  const resolvedVersions = versions ?? await versionsRepo.list(timeline.id);
  downloadTimelineJSON(timeline, resolvedVersions);
}
