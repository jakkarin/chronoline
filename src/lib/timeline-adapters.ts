import { VERSION_SCHEMA_VERSION } from '@/lib/db/schema';
import { timelineRepo } from '@/lib/db/timelines';
import { versionsRepo } from '@/lib/db/versions';
import { newId } from '@/lib/id';
import { downloadTimelineJSON } from '@/lib/timeline-json';
import {
  saveTimelineToFile,
  type DirectEditNavigationState,
  type EditorSession,
} from '@/lib/timeline-file';
import type { Project, Timeline, TimelineVersion } from '@/lib/types';

export interface LoadedTimelineSession {
  timeline: Timeline;
  session: EditorSession;
}

interface TimelineAdapterContext {
  timeline: Timeline;
  session: EditorSession;
}

interface TimelineStorageAdapter {
  canAutosave: boolean;
  saveActionLabel: string;
  persistTimeline: (context: TimelineAdapterContext) => Promise<EditorSession>;
  saveTimeline: (context: TimelineAdapterContext) => Promise<EditorSession>;
  listVersions: (context: TimelineAdapterContext) => Promise<TimelineVersion[]>;
  saveVersion: (context: TimelineAdapterContext, name: string, note?: string) => Promise<EditorSession>;
  renameVersion: (context: TimelineAdapterContext, versionId: string, name: string) => Promise<EditorSession>;
  deleteVersion: (context: TimelineAdapterContext, versionId: string) => Promise<EditorSession>;
  restoreVersion: (
    context: TimelineAdapterContext,
    versionId: string,
    backupCurrent: boolean
  ) => Promise<LoadedTimelineSession>;
}

function computeCounts(projects: Project[]) {
  return {
    projectCount: projects.length,
    taskCount: projects.reduce((sum, project) => sum + project.tasks.length, 0),
  };
}

function buildVersionSnapshot(timeline: Timeline) {
  return structuredClone({
    projects: timeline.projects,
    holidays: timeline.holidays,
  });
}

function createInMemoryVersion(timeline: Timeline, name: string, note?: string): TimelineVersion {
  const snapshot = buildVersionSnapshot(timeline);

  return {
    id: newId('v'),
    timelineId: timeline.id,
    name: name.trim(),
    note: note?.trim() || undefined,
    createdAt: Date.now(),
    schemaVersion: VERSION_SCHEMA_VERSION,
    snapshot,
    stats: computeCounts(snapshot.projects),
  };
}

function replaceFileVersions(session: Extract<EditorSession, { mode: 'file' }>, versions: TimelineVersion[]): EditorSession {
  return {
    ...session,
    versions,
  };
}

const indexedDbAdapter: TimelineStorageAdapter = {
  canAutosave: true,
  saveActionLabel: 'Save JSON',

  async persistTimeline({ timeline, session }) {
    await timelineRepo.update(timeline.id, timeline);
    return session;
  },

  async saveTimeline({ timeline, session }) {
    const versions = await versionsRepo.list(timeline.id);
    downloadTimelineJSON(timeline, versions);
    return session;
  },

  listVersions({ timeline }) {
    return versionsRepo.list(timeline.id);
  },

  async saveVersion({ timeline, session }, name, note) {
    await versionsRepo.create(timeline.id, name, note);
    return session;
  },

  async renameVersion({ session }, versionId, name) {
    await versionsRepo.rename(versionId, name.trim());
    return session;
  },

  async deleteVersion({ session }, versionId) {
    await versionsRepo.remove(versionId);
    return session;
  },

  async restoreVersion({ timeline, session }, versionId, backupCurrent) {
    await versionsRepo.restore(versionId, { backupCurrent });
    const refreshed = await timelineRepo.get(timeline.id);
    if (!refreshed) {
      throw new Error('Timeline not found');
    }
    return {
      timeline: refreshed,
      session,
    };
  },
};

const fileAdapter: TimelineStorageAdapter = {
  canAutosave: false,
  saveActionLabel: 'Save File',

  async persistTimeline({ session }) {
    return session;
  },

  async saveTimeline({ timeline, session }) {
    if (session.mode !== 'file') {
      throw new Error('Expected a file-backed session');
    }

    await saveTimelineToFile({
      timeline,
      fileHandle: session.fileHandle,
      versions: session.versions,
    });

    return session;
  },

  async listVersions({ session }) {
    if (session.mode !== 'file') {
      throw new Error('Expected a file-backed session');
    }
    return session.versions;
  },

  async saveVersion({ timeline, session }, name, note) {
    if (session.mode !== 'file') {
      throw new Error('Expected a file-backed session');
    }

    return replaceFileVersions(session, [createInMemoryVersion(timeline, name, note), ...session.versions]);
  },

  async renameVersion({ session }, versionId, name) {
    if (session.mode !== 'file') {
      throw new Error('Expected a file-backed session');
    }

    const trimmed = name.trim();
    return replaceFileVersions(
      session,
      session.versions.map((version) =>
        version.id === versionId
          ? {
              ...version,
              name: trimmed,
            }
          : version
      )
    );
  },

  async deleteVersion({ session }, versionId) {
    if (session.mode !== 'file') {
      throw new Error('Expected a file-backed session');
    }

    return replaceFileVersions(
      session,
      session.versions.filter((version) => version.id !== versionId)
    );
  },

  async restoreVersion({ timeline, session }, versionId, backupCurrent) {
    if (session.mode !== 'file') {
      throw new Error('Expected a file-backed session');
    }

    const version = session.versions.find((entry) => entry.id === versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const versions = backupCurrent
      ? [
          createInMemoryVersion(
            timeline,
            `Before restore "${version.name}"`,
            `Auto-saved on ${new Date().toLocaleString()}`
          ),
          ...session.versions,
        ]
      : session.versions;

    return {
      timeline: {
        ...timeline,
        ...computeCounts(version.snapshot.projects),
        updatedAt: Date.now(),
        projects: structuredClone(version.snapshot.projects),
        holidays: structuredClone(version.snapshot.holidays),
      },
      session: replaceFileVersions(session, versions),
    };
  },
};

export function getTimelineAdapter(session: EditorSession): TimelineStorageAdapter {
  return session.mode === 'file' ? fileAdapter : indexedDbAdapter;
}

export async function loadTimelineSession(options: {
  id?: string;
  navigationState?: DirectEditNavigationState | null;
}): Promise<LoadedTimelineSession | null> {
  const directEdit = options.navigationState?.directEdit;
  if (directEdit) {
    return {
      timeline: directEdit.timeline,
      session: {
        mode: 'file',
        fileHandle: directEdit.fileHandle,
        fileName: directEdit.fileName,
        versions: directEdit.versions,
      },
    };
  }

  if (!options.id) {
    return null;
  }

  const timeline = await timelineRepo.get(options.id);
  if (!timeline) {
    return null;
  }

  return {
    timeline,
    session: {
      mode: 'indexeddb',
      timelineId: options.id,
    },
  };
}

export async function saveTimelineForSession(timeline: Timeline, session: EditorSession) {
  return getTimelineAdapter(session).saveTimeline({ timeline, session });
}