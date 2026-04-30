import { db } from './schema';
import { timelineRepo } from './timelines';
import type { Project } from '@/lib/types';

const SEED_PROJECTS: Project[] = [
  {
    id: 'p_seed_1',
    name: 'Discovery & Planning',
    status: 'Done',
    deliverable: 'Project Charter',
    expanded: true,
    tasks: [
      { id: 't_seed_1', name: 'Requirements Gathering', status: 'Done', priority: 'HIGHEST', owner: 'Alice',   startDate: '2026-04-28', endDate: '2026-04-29', deliverable: 'Requirements doc', percentComplete: 100 },
      { id: 't_seed_2', name: 'Architecture Design',    status: 'Done', priority: 'HIGH',    owner: 'Bob',     startDate: '2026-04-29', endDate: '2026-04-30', deliverable: 'System diagram',   percentComplete: 100 },
      { id: 't_seed_3', name: 'Database Schema',        status: 'Done', priority: 'HIGH',    owner: 'Alice',   startDate: '2026-04-30', endDate: '2026-04-30', deliverable: 'ERD',              percentComplete: 100 },
    ],
  },
  {
    id: 'p_seed_2',
    name: 'Frontend Development',
    status: 'In Progress',
    deliverable: 'Web App',
    expanded: true,
    tasks: [
      { id: 't_seed_4',  name: 'UI/UX Design',      status: 'Done',        priority: 'HIGHEST', owner: 'Carol',   startDate: '2026-05-01', endDate: '2026-05-08', deliverable: 'Figma prototype', percentComplete: 100 },
      { id: 't_seed_5',  name: 'Component Library',  status: 'In Progress', priority: 'HIGH',    owner: 'Bob',     startDate: '2026-05-01', endDate: '2026-05-15', deliverable: 'Storybook',       percentComplete: 60  },
      { id: 't_seed_6',  name: 'Dashboard Page',     status: 'In Progress', priority: 'HIGH',    owner: 'Carol',   startDate: '2026-05-11', endDate: '2026-05-15', deliverable: '',               percentComplete: 40  },
      { id: 't_seed_7',  name: 'Detail Page',        status: 'Not Started', priority: 'HIGH',    owner: 'Bob',     startDate: '2026-05-18', endDate: '2026-05-22', deliverable: '',               percentComplete: 0   },
      { id: 't_seed_8',  name: 'Reports Page',       status: 'Not Started', priority: 'MED',     owner: 'Carol',   startDate: '2026-05-25', endDate: '2026-05-29', deliverable: '',               percentComplete: 0   },
      { id: 't_seed_9',  name: 'Frontend Integration', status: 'Not Started', priority: 'MED',   owner: 'Alice',   startDate: '2026-05-18', endDate: '2026-05-29', deliverable: '',               percentComplete: 0   },
    ],
  },
  {
    id: 'p_seed_3',
    name: 'Backend Development',
    status: 'In Progress',
    deliverable: 'REST API',
    expanded: true,
    tasks: [
      { id: 't_seed_10', name: 'Auth Service',       status: 'Done',        priority: 'HIGHEST', owner: 'Alice', startDate: '2026-05-01', endDate: '2026-05-08', deliverable: 'Auth API',   percentComplete: 100 },
      { id: 't_seed_11', name: 'Core API',           status: 'In Progress', priority: 'HIGH',    owner: 'Bob',   startDate: '2026-05-04', endDate: '2026-05-22', deliverable: 'API docs',   percentComplete: 50  },
      { id: 't_seed_12', name: 'Notification Service', status: 'Not Started', priority: 'MED',   owner: 'Alice', startDate: '2026-05-18', endDate: '2026-05-22', deliverable: '',           percentComplete: 0   },
      { id: 't_seed_13', name: 'Admin Panel API',    status: 'Not Started', priority: 'LOW',     owner: 'Bob',   startDate: '2026-05-15', endDate: '2026-05-29', deliverable: '',           percentComplete: 0   },
      { id: 't_seed_14', name: 'Reporting API',      status: 'Not Started', priority: 'LOWEST',  owner: 'Alice', startDate: '2026-05-25', endDate: '2026-05-29', deliverable: '',           percentComplete: 0   },
    ],
  },
  {
    id: 'p_seed_4',
    name: 'Quality Assurance',
    status: 'Not Started',
    deliverable: 'Test Report',
    expanded: true,
    tasks: [
      { id: 't_seed_15', name: 'Unit Testing',       status: 'Not Started', priority: 'HIGH',    owner: 'Carol', startDate: '2026-06-01', endDate: '2026-06-02', deliverable: 'Coverage report', percentComplete: 0 },
      { id: 't_seed_16', name: 'Integration Testing', status: 'Not Started', priority: 'HIGH',   owner: 'Alice', startDate: '2026-06-01', endDate: '2026-06-03', deliverable: '',               percentComplete: 0 },
      { id: 't_seed_17', name: 'User Acceptance Test', status: 'Not Started', priority: 'MED',   owner: 'Carol', startDate: '2026-06-03', endDate: '2026-06-05', deliverable: 'UAT sign-off',   percentComplete: 0 },
    ],
  },
  {
    id: 'p_seed_5',
    name: 'Deployment',
    status: 'Not Started',
    deliverable: 'Go Live',
    expanded: true,
    tasks: [
      { id: 't_seed_18', name: 'Staging Deploy',    status: 'Not Started', priority: 'MED', owner: 'Bob',   startDate: '2026-06-05', endDate: '2026-06-05', deliverable: '',          percentComplete: 0 },
      { id: 't_seed_19', name: 'Performance Test',  status: 'Not Started', priority: 'MED', owner: 'Alice', startDate: '2026-06-08', endDate: '2026-06-09', deliverable: '',          percentComplete: 0 },
      { id: 't_seed_20', name: 'Production Deploy', status: 'Not Started', priority: 'MED', owner: 'Bob',   startDate: '2026-06-10', endDate: '2026-06-10', deliverable: 'Go live',   percentComplete: 0 },
    ],
  },
];

let seedPromise: Promise<void> | null = null;

export function seedDemoDataIfEmpty(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const count = await db.timelineMeta.count();
    if (count > 0) return;
    await timelineRepo.create({
      title: 'Sample Project Timeline',
      customer: 'Acme Corp',
      startDate: '2026-04-27',
      weeks: 10,
      note: 'Demo data',
      projects: SEED_PROJECTS,
      holidays: [],
    });
  })();
  return seedPromise;
}
