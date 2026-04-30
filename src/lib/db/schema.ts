import Dexie, { type Table } from 'dexie';
import type { TimelineMeta, TimelineData } from '@/lib/types';

export class TimelineDB extends Dexie {
  timelineMeta!: Table<TimelineMeta, string>;
  timelineData!: Table<TimelineData, string>;

  constructor() {
    super('project-timeline-db');
    this.version(1).stores({
      timelineMeta: 'id, updatedAt, title, customer',
      timelineData: 'id',
    });
  }
}

export const db = new TimelineDB();
