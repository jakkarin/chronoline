import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecentTaskColors } from '@/hooks/use-recent-task-colors';
import { loadTimelineSession } from '@/lib/timeline-adapters';
import { useTimelineStore } from '@/store/timeline-store';
import type { DirectEditNavigationState } from '@/lib/timeline-file';

export function useTimeline(id: string | undefined) {
  const setTimeline = useTimelineStore((s) => s.setTimeline);
  const setEditorSession = useTimelineStore((s) => s.setEditorSession);
  const { syncFromTimeline } = useRecentTaskColors();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const location = useLocation();
  const directEdit = (location.state as DirectEditNavigationState | null)?.directEdit;

  useEffect(() => {
    setLoading(true);
    setNotFound(false);

    void loadTimelineSession({ id, navigationState: directEdit ? { directEdit } : null }).then((loaded) => {
      if (!loaded) {
        setNotFound(true);
      } else {
        syncFromTimeline(loaded.timeline);
        setTimeline(loaded.timeline);
        setEditorSession(loaded.session);
        useTimelineStore.temporal.getState().clear();
      }
      setLoading(false);
    });

    return () => {
      useTimelineStore.temporal.getState().clear();
      setTimeline(null);
      setEditorSession(null);
    };
  }, [directEdit, id, setEditorSession, setTimeline, syncFromTimeline]);

  return { loading, notFound };
}
