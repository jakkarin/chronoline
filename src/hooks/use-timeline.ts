import { useEffect, useState } from 'react';
import { useTimelineStore } from '@/store/timeline-store';
import { timelineRepo } from '@/lib/db/timelines';

export function useTimeline(id: string | undefined) {
  const setTimeline = useTimelineStore((s) => s.setTimeline);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    timelineRepo.get(id).then((tl) => {
      if (!tl) {
        setNotFound(true);
      } else {
        setTimeline(tl);
      }
      setLoading(false);
    });
    return () => {
      setTimeline(null);
    };
  }, [id, setTimeline]);

  return { loading, notFound };
}
