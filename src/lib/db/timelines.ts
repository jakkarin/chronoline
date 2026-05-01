import { db } from './schema';
import { versionsRepo } from './versions';
import type { Timeline, TimelineMeta, TimelineData, Project } from '@/lib/types';
import { newId } from '@/lib/id';

function derivedCounts(projects: Project[]) {
  return {
    projectCount: projects.length,
    taskCount: projects.reduce((s, p) => s + p.tasks.length, 0),
  };
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
