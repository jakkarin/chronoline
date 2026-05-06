import { db } from './schema';
import { versionsRepo } from './versions';
import { VERSION_SCHEMA_VERSION } from './schema';
import type { Timeline, TimelineMeta, TimelineData, Project, TimelineVersion } from '@/lib/types';
import { newId } from '@/lib/id';

function derivedCounts(projects: Project[]) {
  return {
    projectCount: projects.length,
    taskCount: projects.reduce((s, p) => s + p.tasks.length, 0),
  };
}

function cloneImportedVersions(timelineId: string, versions: TimelineVersion[]): TimelineVersion[] {
  return versions.map((version) => {
    if (version.schemaVersion !== VERSION_SCHEMA_VERSION) {
      throw new Error(`Unsupported imported version schema: v${version.schemaVersion}`);
    }

    const snapshot = structuredClone({
      projects: version.snapshot.projects,
      holidays: version.snapshot.holidays ?? [],
    });

    return {
      ...version,
      id: newId('v'),
      timelineId,
      note: version.note?.trim() || undefined,
      snapshot,
      stats: derivedCounts(snapshot.projects),
    };
  });
}

export const timelineRepo = {
  async list(): Promise<TimelineMeta[]> {
    return db.timelineMeta.orderBy('updatedAt').reverse().toArray();
  },

  async get(id: string): Promise<Timeline | null> {
    const [meta, data] = await Promise.all([
      db.timelineMeta.get(id),
      db.timelineData.get(id),
    ]);
    if (!meta || !data) return null;
    return { ...meta, projects: data.projects, holidays: data.holidays ?? [] };
  },

  async create(input: Partial<Timeline>): Promise<string> {
    const id = newId('tl');
    const now = Date.now();
    const projects = input.projects ?? [];
    const holidays = input.holidays ?? [];
    const meta: TimelineMeta = {
      id,
      title: input.title ?? 'Untitled Timeline',
      customer: input.customer ?? '',
      startDate: input.startDate ?? new Date().toISOString().slice(0, 10),
      weeks: input.weeks ?? 9,
      note: input.note ?? '',
      createdAt: now,
      updatedAt: now,
      ...derivedCounts(projects),
    };
    const data: TimelineData = { id, projects, holidays };
    await Promise.all([
      db.timelineMeta.add(meta),
      db.timelineData.add(data),
    ]);
    return id;
  },

  async createFromImport(input: Timeline, versions: TimelineVersion[] = []): Promise<string> {
    const id = newId('tl');
    const now = Date.now();
    const projects = structuredClone(input.projects);
    const holidays = structuredClone(input.holidays ?? []);
    const importedVersions = cloneImportedVersions(id, versions);
    const meta: TimelineMeta = {
      id,
      title: input.title,
      customer: input.customer,
      startDate: input.startDate,
      weeks: input.weeks,
      note: input.note,
      createdAt: now,
      updatedAt: now,
      ...derivedCounts(projects),
    };
    const data: TimelineData = { id, projects, holidays };

    await db.transaction('rw', db.timelineMeta, db.timelineData, db.timelineVersions, async () => {
      await db.timelineMeta.add(meta);
      await db.timelineData.add(data);
      if (importedVersions.length > 0) {
        await db.timelineVersions.bulkAdd(importedVersions);
      }
    });

    return id;
  },

  async update(id: string, patch: Partial<Timeline>): Promise<void> {
    const now = Date.now();
    const updates: Partial<TimelineMeta> = {
      updatedAt: now,
    };
    const metaFields: (keyof TimelineMeta)[] = [
      'title', 'customer', 'startDate', 'weeks', 'note',
    ];
    for (const f of metaFields) {
      if (f in patch) {
        (updates as Record<string, unknown>)[f] = patch[f];
      }
    }

    if (patch.projects !== undefined) {
      Object.assign(updates, derivedCounts(patch.projects));
      await db.timelineData.update(id, {
        projects: patch.projects,
        ...(patch.holidays !== undefined ? { holidays: patch.holidays } : {}),
      });
    } else if (patch.holidays !== undefined) {
      await db.timelineData.update(id, { holidays: patch.holidays });
    }

    await db.timelineMeta.update(id, updates);
  },

  async replaceFromImport(id: string, input: Timeline, versions: TimelineVersion[] = []): Promise<void> {
    const now = Date.now();
    const projects = structuredClone(input.projects);
    const holidays = structuredClone(input.holidays ?? []);
    const importedVersions = cloneImportedVersions(id, versions);

    await db.transaction('rw', db.timelineMeta, db.timelineData, db.timelineVersions, async () => {
      await db.timelineData.put({ id, projects, holidays });
      await db.timelineMeta.update(id, {
        title: input.title,
        customer: input.customer,
        startDate: input.startDate,
        weeks: input.weeks,
        note: input.note,
        updatedAt: now,
        ...derivedCounts(projects),
      });
      await db.timelineVersions.where('timelineId').equals(id).delete();
      if (importedVersions.length > 0) {
        await db.timelineVersions.bulkAdd(importedVersions);
      }
    });
  },

  async delete(id: string): Promise<void> {
    await Promise.all([
      db.timelineMeta.delete(id),
      db.timelineData.delete(id),
      versionsRepo.removeAllForTimeline(id),
    ]);
  },

  async duplicate(id: string): Promise<string> {
    const tl = await timelineRepo.get(id);
    if (!tl) throw new Error('Not found');
    return timelineRepo.create({
      ...tl,
      title: `${tl.title} (copy)`,
    });
  },
};
