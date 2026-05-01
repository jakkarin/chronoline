import Dexie, { type Table } from 'dexie';
import type { TimelineMeta, TimelineData, TimelineVersion } from '@/lib/types';

export const VERSION_SCHEMA_VERSION = 1;

export class TimelineDB extends Dexie {
  timelineMeta!: Table<TimelineMeta, string>;
  timelineData!: Table<TimelineData, string>;
  timelineVersions!: Table<TimelineVersion, string>;

  constructor() {
    super('project-timeline-db');
    this.version(1).stores({
      timelineMeta: 'id, updatedAt, title, customer',
      timelineData: 'id',
    });
    this.version(2).stores({
      timelineMeta: 'id, updatedAt, title, customer',
      timelineData: 'id',
      timelineVersions: 'id, timelineId, createdAt, [timelineId+createdAt]',
    });
  }
}

export const db = new TimelineDB();
