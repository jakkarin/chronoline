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
  const location = useLocation();
  const directEdit = (location.state as DirectEditNavigationState | null)?.directEdit;
  // Outcome of the last finished load, tagged with what it loaded. `loading` is derived
  // from whether that tag matches the current request, so nothing resets state in the effect.
  const [result, setResult] = useState<{
    id: string | undefined;
    directEdit: typeof directEdit;
    notFound: boolean;
  } | null>(null);

  useEffect(() => {
    void loadTimelineSession({ id, navigationState: directEdit ? { directEdit } : null }).then((loaded) => {
      if (loaded) {
        syncFromTimeline(loaded.timeline);
        setTimeline(loaded.timeline);
        setEditorSession(loaded.session);
        useTimelineStore.temporal.getState().clear();
      }
      setResult({ id, directEdit, notFound: !loaded });
    });

    return () => {
      useTimelineStore.temporal.getState().clear();
      setTimeline(null);
      setEditorSession(null);
    };
  }, [directEdit, id, setEditorSession, setTimeline, syncFromTimeline]);

  const isCurrent = result !== null && result.id === id && result.directEdit === directEdit;
  return { loading: !isCurrent, notFound: isCurrent && result.notFound };
}
