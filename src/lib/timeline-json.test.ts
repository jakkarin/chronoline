import { describe, it, expect } from 'vitest';
import { buildTimelineExportEnvelope } from '@/lib/timeline-json';
import type { Timeline } from '@/lib/types';

describe('buildTimelineExportEnvelope', () => {
  it('writes project and task counts that match the content', () => {
    const tl = {
      id: 'tl_1', title: 'T', customer: '', startDate: '2026-11-16', weeks: 4, note: '', createdAt: 0, updatedAt: 0,
      projectCount: 1, taskCount: 1, holidays: [],
      projects: [
        { id: 'p_1', tasks: [{ id: 't_1' }, { id: 't_2' }] },
        { id: 'p_2', tasks: [{ id: 't_3' }] },
      ],
    } as unknown as Timeline;
    const env = buildTimelineExportEnvelope(tl);
    expect(env.timeline.projectCount).toBe(2);
    expect(env.timeline.taskCount).toBe(3);
  });
});
