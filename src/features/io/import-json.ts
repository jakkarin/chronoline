import { z } from 'zod';
import { HEX_TASK_COLOR_PATTERN, TASK_COLOR_VALUES } from '@/lib/task-colors';
import type { ParsedTimelineImport, Project, Task, TimelineVersion } from '@/lib/types';

const PRESET_TASK_COLORS = new Set<string>(TASK_COLOR_VALUES);

const TaskColorSchema = z.custom<Task['color']>(
  (value): value is Task['color'] =>
    value === undefined ||
    value === null ||
    (typeof value === 'string' && (PRESET_TASK_COLORS.has(value) || HEX_TASK_COLOR_PATTERN.test(value))),
  'Invalid task color'
);

const TaskSchema: z.ZodType<Task> = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['Not Started', 'In Progress', 'Done', 'Blocked', 'On Hold']),
  priority: z.enum(['HIGHEST', 'HIGH', 'MED', 'LOW', 'LOWEST']).nullable(),
  color: TaskColorSchema,
  owner: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  deliverable: z.string(),
  percentComplete: z.number(),
});

const ProjectSchema: z.ZodType<Project> = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['Not Started', 'In Progress', 'Done', 'Blocked', 'On Hold']),
  deliverable: z.string(),
  expanded: z.boolean(),
  tasks: z.array(TaskSchema),
});

const BaseTimelineSchema = z.object({
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
  holidays: z.array(z.string()).default([]),
});

const TimelineVersionSnapshotSchema: z.ZodType<TimelineVersion['snapshot']> = z.object({
  projects: z.array(ProjectSchema),
  holidays: z.array(z.string()).default([]),
});

const TimelineVersionSchema: z.ZodType<TimelineVersion> = z.object({
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
  timeline: BaseTimelineSchema,
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
      id: result.data.timeline.id,
      title: result.data.timeline.title,
      customer: result.data.timeline.customer,
      startDate: result.data.timeline.startDate,
      weeks: result.data.timeline.weeks,
      note: result.data.timeline.note,
      createdAt: result.data.timeline.createdAt,
      updatedAt: result.data.timeline.updatedAt,
      projectCount: result.data.timeline.projectCount,
      taskCount: result.data.timeline.taskCount,
      projects: result.data.timeline.projects,
      holidays: result.data.timeline.holidays,
    },
    versions: result.data.versions ?? [],
  };
}
