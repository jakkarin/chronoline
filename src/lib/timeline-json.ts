import type { Timeline, TimelineExport, TimelineVersion } from '@/lib/types';

export function buildTimelineExportEnvelope(
  timeline: Timeline,
  versions: TimelineVersion[] = []
): TimelineExport {
  return {
    $schema: 'project-timeline/v1',
    exportedAt: new Date().toISOString(),
    timeline,
    versions,
  };
}

export function downloadTimelineJSON(timeline: Timeline, versions: TimelineVersion[] = []) {
  const envelope = buildTimelineExportEnvelope(timeline, versions);
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safe = (timeline.title || 'timeline').replace(/[^a-z0-9\-_\s]/gi, '').slice(0, 60).trim() || 'timeline';
  const date = new Date().toISOString().slice(0, 10);
  anchor.download = `${safe}_${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}