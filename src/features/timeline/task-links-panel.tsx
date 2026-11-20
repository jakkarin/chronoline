import { Link2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LINK_REJECTION_MESSAGE } from '@/lib/dependencies';
import { useTimelineStore } from '@/store/timeline-store';
import { TaskSearchSelect } from './task-search-select';

/** Row button showing how many tasks this one follows; opens a panel to manage those links. */
export function TaskLinksPanel({ taskId }: { taskId: string }) {
  const timeline = useTimelineStore((s) => s.timeline);
  const addDependency = useTimelineStore((s) => s.addDependency);
  const setDependencyFollow = useTimelineStore((s) => s.setDependencyFollow);
  const removeDependency = useTimelineStore((s) => s.removeDependency);
  if (!timeline) return null;

  const lookup = new Map(timeline.projects.flatMap((p) => p.tasks.map((t) => [t.id, { task: t, project: p.name }] as const)));
  const self = lookup.get(taskId)?.task;
  if (!self) return null;
  const deps = self.dependsOn ?? [];

  const add = (parentId: string) => {
    const r = addDependency(taskId, parentId);
    if (!r.ok) toast.error(LINK_REJECTION_MESSAGE[r.reason]);
  };

  return (
    <Popover>
      <PopoverTrigger
        className={`ml-1 flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] hover:bg-muted ${deps.length ? 'text-foreground' : 'text-muted-foreground/50 opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100'}`}
        aria-label={`Links for ${self.name}`}
      >
        <Link2 className="h-3 w-3" />
        {deps.length > 0 && <span className="font-mono">{deps.length}</span>}
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <p className="text-xs font-medium">{self.name} follows</p>
        {deps.length === 0 && <p className="text-xs text-muted-foreground">No links yet</p>}
        <ul className="flex flex-col gap-1">
          {deps.map((d) => {
            const parent = lookup.get(d.taskId);
            const name = parent?.task.name ?? d.taskId;
            return (
              <li key={d.taskId} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{parent?.project}</p>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px]">
                  <Checkbox
                    checked={d.follow}
                    onCheckedChange={(v) => setDependencyFollow(taskId, d.taskId, v === true)}
                    aria-label={`Move with ${name}`}
                  />
                  Move with
                </label>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={() => removeDependency(taskId, d.taskId)}
                  aria-label={`Remove link to ${name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="pt-1 text-xs font-medium">Add link</p>
        <TaskSearchSelect excludeIds={[taskId, ...deps.map((d) => d.taskId)]} onSelect={add} placeholder="Follow which task?" />
      </PopoverContent>
    </Popover>
  );
}
