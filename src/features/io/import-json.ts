import { z } from 'zod';
import { HEX_TASK_COLOR_PATTERN, TASK_COLOR_VALUES } from '@/lib/task-colors';
import type { ParsedTimelineImport } from '@/lib/types';

const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['Not Started', 'In Progress', 'Done', 'Blocked', 'On Hold']),
  priority: z.enum(['HIGHEST', 'HIGH', 'MED', 'LOW', 'LOWEST']).nullable(),
  color: z.union([z.enum(TASK_COLOR_VALUES), z.string().regex(HEX_TASK_COLOR_PATTERN)]).nullable().optional(),
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

const TimelineVersionSnapshotSchema = z.object({
  projects: z.array(ProjectSchema),
  holidays: z.array(z.string()).optional(),
});

const TimelineVersionSchema = z.object({
  id: z.string(),
  timelineId: z.string(),
  name: z.string(),
  note: z.string().optional(),
  createdAt: z.number(),
  schemaVersion: z.number(),
  snapshot: TimelineVersionSnapshotSchema,
  stats: z.object({
    projectCount: z.number(),
    taskCount: z.number(),
  }),
});

const EnvelopeSchema = z.object({
  $schema: z.literal('project-timeline/v1'),
  exportedAt: z.string(),
  timeline: TimelineSchema,
  versions: z.array(TimelineVersionSchema).optional(),
});

export function parseImportJSON(raw: string): ParsedTimelineImport {
  const parsed = JSON.parse(raw);
  const result = EnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Invalid file format: ' + result.error.issues[0]?.message);
  }
  return {
    timeline: {
      ...result.data.timeline,
      holidays: result.data.timeline.holidays ?? [],
    },
    versions: (result.data.versions ?? []).map((version) => ({
      ...version,
      snapshot: {
        ...version.snapshot,
        holidays: version.snapshot.holidays ?? [],
      },
    })),
  };
}
