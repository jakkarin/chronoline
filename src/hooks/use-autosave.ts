import { useEffect, useRef } from 'react';
import { useTimelineStore } from '@/store/timeline-store';
import { timelineRepo } from '@/lib/db/timelines';

export function useAutosave() {
  const timeline = useTimelineStore((s) => s.timeline);
  const setSaveStatus = useTimelineStore((s) => s.setSaveStatus);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!timeline) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await timelineRepo.update(timeline.id, timeline);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeline, setSaveStatus]);
}
