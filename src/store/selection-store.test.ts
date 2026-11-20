import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskSelectionStore, selectExistingIds } from '@/store/selection-store';
import type { Project } from '@/lib/types';

const sel = () => useTaskSelectionStore.getState();

describe('useTaskSelectionStore', () => {
  beforeEach(() => sel().clear());

  it('toggle adds then removes', () => {
    sel().toggle('t_a');
    expect(sel().selectedIds.has('t_a')).toBe(true);
    sel().toggle('t_a');
    expect(sel().selectedIds.has('t_a')).toBe(false);
  });

  it('setMany selects and deselects', () => {
    sel().setMany(['t_a', 't_b'], true);
    expect(sel().selectedIds.size).toBe(2);
    sel().setMany(['t_a'], false);
    expect([...sel().selectedIds]).toEqual(['t_b']);
  });

  it('clear empties', () => {
    sel().setMany(['t_a'], true);
    sel().clear();
    expect(sel().selectedIds.size).toBe(0);
  });

  it('replaces the Set instance on change so selectors re-render', () => {
    const before = sel().selectedIds;
    sel().toggle('t_a');
    expect(sel().selectedIds).not.toBe(before);
  });
});

describe('selectExistingIds', () => {
  const projects = [
    { tasks: [{ id: 't_1' }, { id: 't_2' }] },
    { tasks: [{ id: 't_3' }] },
  ] as unknown as Project[];

  it('selectExistingIds ignores missing ids', () => {
    expect(selectExistingIds(new Set(['t_3', 't_gone', 't_1']), { projects })).toEqual(['t_1', 't_3']);
  });

  it('selectExistingIds with null timeline', () => {
    expect(selectExistingIds(new Set(['t_1']), null)).toEqual([]);
  });
});
