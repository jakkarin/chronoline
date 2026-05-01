import Dexie from 'dexie';
import { db, VERSION_SCHEMA_VERSION } from './schema';
import type { TimelineVersion } from '@/lib/types';
import { newId } from '@/lib/id';

function computeStats(snapshot: TimelineVersion['snapshot']) {
  return {
    projectCount: snapshot.projects.length,
    taskCount: snapshot.projects.reduce((s, p) => s + p.tasks.length, 0),
  };
}

export const versionsRepo = {
  async create(timelineId: string, name: string, note?: string): Promise<TimelineVersion> {
    const data = await db.timelineData.get(timelineId);
    if (!data) throw new Error('Timeline not found');
    const snapshot = structuredClone({
      projects: data.projects,
      holidays: data.holidays ?? [],
    });
    const version: TimelineVersion = {
      id: newId('v'),
      timelineId,
      name: name.trim(),
      note: note?.trim() || undefined,
      createdAt: Date.now(),
      schemaVersion: VERSION_SCHEMA_VERSION,
      snapshot,
      stats: computeStats(snapshot),
    };
    await db.timelineVersions.add(version);
    return version;
  },

  async list(timelineId: string): Promise<TimelineVersion[]> {
    return db.timelineVersions
      .where('[timelineId+createdAt]')
      .between([timelineId, Dexie.minKey], [timelineId, Dexie.maxKey])
      .reverse()
      .toArray();
  },

  async rename(id: string, name: string): Promise<void> {
    await db.timelineVersions.update(id, { name: name.trim() });
  },

  async updateNote(id: string, note: string): Promise<void> {
    await db.timelineVersions.update(id, { note: note.trim() || undefined });
  },

  async remove(id: string): Promise<void> {
    await db.timelineVersions.delete(id);
  },

  async removeAllForTimeline(timelineId: string): Promise<void> {
    await db.timelineVersions.where('timelineId').equals(timelineId).delete();
  },

  async restore(
    versionId: string,
    opts: { backupCurrent?: boolean } = {},
  ): Promise<TimelineVersion> {
    const v = await db.timelineVersions.get(versionId);
    if (!v) throw new Error('Version not found');
    if (v.schemaVersion !== VERSION_SCHEMA_VERSION) {
      throw new Error(`Unsupported version schema: v${v.schemaVersion}`);
    }

    if (opts.backupCurrent) {
      await versionsRepo.create(
        v.timelineId,
        `Before restore "${v.name}"`,
        `Auto-saved on ${new Date().toLocaleString()}`,
      );
    }

    const now = Date.now();
    const snapshot = structuredClone(v.snapshot);
    await db.timelineData.put({
      id: v.timelineId,
      projects: snapshot.projects,
      holidays: snapshot.holidays,
    });
    await db.timelineMeta.update(v.timelineId, {
      updatedAt: now,
      projectCount: v.stats.projectCount,
      taskCount: v.stats.taskCount,
    });
    return v;
  },
};

