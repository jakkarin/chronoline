export type Status = 'Not Started' | 'In Progress' | 'Done' | 'Blocked' | 'On Hold';

export type Priority = 'HIGHEST' | 'HIGH' | 'MED' | 'LOW' | 'LOWEST' | null;

export type PresetTaskColor = 'ROSE' | 'AMBER' | 'EMERALD' | 'SKY' | 'VIOLET' | 'SLATE';

export type TaskColor = PresetTaskColor | `#${string}`;

export interface Task {
  id: string;
  name: string;
  status: Status;
  priority: Priority;
  color?: TaskColor | null;
  owner: string;
  startDate: string;
  endDate: string;
  deliverable: string;
  percentComplete: number;
}

export interface Project {
  id: string;
  name: string;
  status: Status;
  deliverable: string;
  expanded: boolean;
  tasks: Task[];
}

export interface TimelineMeta {
  id: string;
  title: string;
  customer: string;
  startDate: string;
  weeks: number;
  note: string;
  createdAt: number;
  updatedAt: number;
  projectCount: number;
  taskCount: number;
}

export interface TimelineData {
  id: string;
  projects: Project[];
  holidays: string[];
}

export interface Timeline extends TimelineMeta {
  projects: Project[];
  holidays: string[];
}

export interface TimelineExport {
  $schema: 'project-timeline/v1';
  exportedAt: string;
  timeline: Timeline;
  versions?: TimelineVersion[];
}

export interface ParsedTimelineImport {
  timeline: Timeline;
  versions: TimelineVersion[];
}

export interface TimelineVersionSnapshot {
  projects: Project[];
  holidays: string[];
}

export interface TimelineVersion {
  id: string;
  timelineId: string;
  name: string;
  note?: string;
  createdAt: number;
  schemaVersion: number;
  snapshot: TimelineVersionSnapshot;
  stats: {
    projectCount: number;
    taskCount: number;
  };
}
