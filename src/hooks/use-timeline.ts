import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTimelineStore } from '@/store/timeline-store';
import { timelineRepo } from '@/lib/db/timelines';
import type { DirectEditNavigationState } from '@/lib/timeline-file';

export function useTimeline(id: string | undefined) {
  const setTimeline = useTimelineStore((s) => s.setTimeline);
  const setEditorSession = useTimelineStore((s) => s.setEditorSession);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const location = useLocation();
  const directEdit = (location.state as DirectEditNavigationState | null)?.directEdit;

  useEffect(() => {
    setLoading(true);
    setNotFound(false);

    if (directEdit) {
      setTimeline(directEdit.timeline);
      setEditorSession({
        mode: 'file',
        fileHandle: directEdit.fileHandle,
        fileName: directEdit.fileName,
        versions: directEdit.versions,
      });
      setLoading(false);
      return () => {
        setTimeline(null);
        setEditorSession(null);
      };
    }

    if (!id) {
      setNotFound(true);
      setLoading(false);
      return () => {
        setTimeline(null);
        setEditorSession(null);
      };
    }

    timelineRepo.get(id).then((tl) => {
      if (!tl) {
        setNotFound(true);
      } else {
        setTimeline(tl);
        setEditorSession({ mode: 'indexeddb', timelineId: id });
      }
      setLoading(false);
    });

    return () => {
      setTimeline(null);
      setEditorSession(null);
    };
  }, [directEdit, id, setEditorSession, setTimeline]);

  return { loading, notFound };
}
