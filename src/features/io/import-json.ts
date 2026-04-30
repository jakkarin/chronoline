import { z } from 'zod';
import type { Timeline } from '@/lib/types';

const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['Not Started', 'In Progress', 'Done', 'Blocked', 'On Hold']),
  priority: z.enum(['HIGHEST', 'HIGH', 'MED', 'LOW', 'LOWEST']).nullable(),
  owner: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  deliverable: z.string(),
  percentComplete: z.number(),
});

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['Not Started', 'In Progress', 'Done', 'Blocked', 'On Hold']),
  deliverable: z.string(),
  expanded: z.boolean(),
  tasks: z.array(TaskSchema),
});

const TimelineSchema = z.object({
  id: z.string(),
  title: z.string(),
  customer: z.string(),
  startDate: z.string(),
  weeks: z.number(),
  note: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  projectCount: z.number(),
  taskCount: z.number(),
  projects: z.array(ProjectSchema),
  holidays: z.array(z.string()).optional(),
});

const EnvelopeSchema = z.object({
  $schema: z.literal('project-timeline/v1'),
  exportedAt: z.string(),
  timeline: TimelineSchema,
});

export function parseImportJSON(raw: string): Timeline {
  const parsed = JSON.parse(raw);
  const result = EnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Invalid file format: ' + result.error.issues[0]?.message);
  }
  return {
    ...result.data.timeline,
    holidays: result.data.timeline.holidays ?? [],
  } as Timeline;
}
