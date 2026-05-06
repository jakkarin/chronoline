import { versionsRepo } from '@/lib/db/versions';
import type { Timeline, TimelineExport } from '@/lib/types';

export async function exportJSON(timeline: Timeline) {
  const versions = await versionsRepo.list(timeline.id);
  const envelope: TimelineExport = {
    $schema: 'project-timeline/v1',
    exportedAt: new Date().toISOString(),
    timeline,
    versions,
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = (timeline.title || 'timeline').replace(/[^a-z0-9\-_\s]/gi, '').slice(0, 60).trim() || 'timeline';
  const date = new Date().toISOString().slice(0, 10);
  a.download = `${safe}_${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
