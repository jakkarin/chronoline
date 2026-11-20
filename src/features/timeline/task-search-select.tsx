import { useMemo, useState } from 'react';
import { useTimelineStore } from '@/store/timeline-store';

interface TaskSearchSelectProps {
  excludeIds: string[];
  onSelect: (taskId: string) => void;
  placeholder?: string;
}

/** Text filter + list of the timeline's tasks grouped by project. Used to pick a task to follow. */
export function TaskSearchSelect({ excludeIds, onSelect, placeholder = 'Search tasks…' }: TaskSearchSelectProps) {
  const projects = useTimelineStore((s) => s.timeline?.projects);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const excluded = new Set(excludeIds);
    const q = query.trim().toLowerCase();
    return (projects ?? [])
      .map((p) => ({
        id: p.id,
        name: p.name,
        tasks: p.tasks.filter((t) => !excluded.has(t.id) && (!q || t.name.toLowerCase().includes(q))),
      }))
      .filter((g) => g.tasks.length > 0);
  }, [projects, excludeIds, query]);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <div className="max-h-48 overflow-auto" role="listbox" aria-label="Tasks">
        {groups.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">No matching tasks</p>}
        {groups.map((g) => (
          <div key={g.id} role="group" aria-label={g.name}>
            <p className="px-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</p>
            {g.tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={false}
                className="block w-full truncate rounded px-1.5 py-1 text-left text-xs hover:bg-muted"
                onClick={() => {
                  setQuery('');
                  onSelect(t.id);
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
