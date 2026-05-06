import { useEffect, useRef } from 'react';
import { getTimelineAdapter } from '@/lib/timeline-adapters';
import { useTimelineStore } from '@/store/timeline-store';

export function useAutosave() {
  const timeline = useTimelineStore((s) => s.timeline);
  const editorSession = useTimelineStore((s) => s.editorSession);
  const setSaveStatus = useTimelineStore((s) => s.setSaveStatus);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!timeline || !editorSession) return;

    const adapter = getTimelineAdapter(editorSession);

    if (!adapter.canAutosave) {
      setSaveStatus('idle');
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await adapter.persistTimeline({ timeline, session: editorSession });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editorSession, timeline, setSaveStatus]);
}
