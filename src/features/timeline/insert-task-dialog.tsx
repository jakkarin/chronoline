import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { nextWeekday, snapToWeekday } from '@/lib/date-utils';
import { shiftWeekdays, weekdayLength } from '@/lib/dependencies';
import { insertCandidates, planInsert, type InsertInput } from '@/lib/insert-task';
import { visibleRange } from '@/lib/timeline-overflow';
import { useTimelineStore } from '@/store/timeline-store';
import { requestDateChange } from './request-date-change';
import { TaskSearchSelect } from './task-search-select';

const short = (d: string) => format(parseISO(d), 'd MMM');
const todayStr = () => format(new Date(), 'yyyy-MM-dd');

interface InsertTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Insert a task and push chosen tasks out of its way. The form keeps its state while
 * closed, so cancelling the "Extend timeline?" dialog can reopen it unchanged; the
 * toolbar remounts it (new key) for a fresh form.
 */
export function InsertTaskDialog({ open, onOpenChange }: InsertTaskDialogProps) {
  const timeline = useTimelineStore((s) => s.timeline);
  const projects = useMemo(() => timeline?.projects ?? [], [timeline]);

  const [initialStart] = useState(() => {
    if (!timeline) return snapToWeekday(todayStr());
    const { first, last } = visibleRange(timeline.startDate, timeline.weeks);
    const today = snapToWeekday(todayStr());
    return today < first || today > last ? first : today;
  });
  const [name, setName] = useState('New Task');
  const [owner, setOwner] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialStart);
  const [followsTaskId, setFollowsTaskId] = useState<string | null>(null);
  const [shift, setShift] = useState(true);
  /** Explicit tick choices; anything not here uses its default. */
  const [choice, setChoice] = useState<Map<string, boolean>>(new Map());

  const valid = !!projectId && endDate >= startDate && name.trim().length > 0;
  const input: InsertInput = { projectId, name: name.trim(), owner, startDate, endDate, followsTaskId };
  const tasks = useMemo(() => new Map(projects.flatMap((p) => p.tasks).map((t) => [t.id, t])), [projects]);

  const { candidates, ticked, unticked, plan } = useMemo(() => {
    const candidates = valid && shift ? insertCandidates(projects, input) : [];
    const ticked = new Set(candidates.filter((c) => choice.get(c.taskId) ?? c.preTicked).map((c) => c.taskId));
    const unticked = new Set([...choice].filter(([, v]) => !v).map(([id]) => id));
    const plan = valid && shift ? planInsert(projects, input, ticked, unticked) : { patches: new Map(), followers: [] };
    return { candidates, ticked, unticked, plan };
  }, [projects, valid, shift, choice, projectId, startDate, endDate, followsTaskId]);

  // Rows: candidates plus any linked follower the cascade moves, grouped by project in table order.
  const followerOf = new Map(plan.followers.map((f) => [f.taskId, f.parentId]));
  const rowIds = new Set([...candidates.map((c) => c.taskId), ...followerOf.keys(), ...unticked]);
  const groups = projects
    .map((p) => ({ project: p, rows: p.tasks.filter((t) => rowIds.has(t.id)) }))
    .filter((g) => g.rows.length > 0);
  const isChecked = (id: string) => ticked.has(id) || followerOf.has(id);
  const toggle = (id: string) => setChoice((m) => new Map(m).set(id, !isChecked(id)));

  const setStart = (d: string) => {
    const len = weekdayLength(startDate, endDate);
    const s = snapToWeekday(d);
    setStartDate(s);
    if (endDate < s) setEndDate(shiftWeekdays(s, len - 1));
  };
  const follow = (parentId: string) => {
    const parent = tasks.get(parentId);
    setFollowsTaskId(parentId);
    if (!parent) return;
    const len = weekdayLength(startDate, endDate);
    const s = nextWeekday(parent.endDate);
    setStartDate(s);
    setEndDate(shiftWeekdays(s, len - 1));
  };

  const submit = () => {
    if (!valid) return;
    onOpenChange(false);
    requestDateChange({ kind: 'insert', input, ticked: [...ticked], unticked: [...unticked] }, () => onOpenChange(true));
  };

  const follows = followsTaskId ? tasks.get(followsTaskId) : undefined;
  const days = endDate >= startDate ? weekdayLength(startDate, endDate) : 0;
  const field = 'h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:ring-1 focus:ring-ring';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Insert task</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Name</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Project</span>
            <select className={field} value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Owner</span>
            <input className={field} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner" />
          </label>
          <div className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Follows</span>
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger className={`${field} flex items-center text-left`} aria-label="Follows">
                  {follows ? follows.name : <span className="text-muted-foreground">— none —</span>}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72">
                  <TaskSearchSelect excludeIds={followsTaskId ? [followsTaskId] : []} onSelect={follow} placeholder="Follow which task?" />
                </PopoverContent>
              </Popover>
              {follows && (
                <Button variant="ghost" size="icon-xs" onClick={() => setFollowsTaskId(null)} aria-label="Clear follows">
                  <X />
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Start</span>
            <DatePicker value={startDate} onChange={setStart} className="h-8 rounded-md border border-input" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">End {days > 0 && <span>· {days} {days === 1 ? 'day' : 'days'}</span>}</span>
            <DatePicker value={endDate} onChange={(d) => setEndDate(snapToWeekday(d))} className="h-8 rounded-md border border-input" />
          </div>
          {endDate < startDate && <p className="col-span-2 text-xs text-destructive">End must be on or after start</p>}
        </div>

        <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox checked={shift} onCheckedChange={(v) => setShift(v === true)} />
          Shift tasks to make room
        </label>
        {shift && valid && (
          <div className="max-h-64 overflow-auto rounded-md border border-border p-2 text-sm" aria-label="Tasks to shift">
            {groups.length === 0 && <p className="text-xs text-muted-foreground">No tasks after this date</p>}
            {groups.map(({ project, rows }) => (
              <div key={project.id} className="mb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{project.name}</p>
                {rows.map((t) => {
                  const next = plan.patches.get(t.id);
                  const parent = followerOf.get(t.id);
                  return (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 py-0.5">
                      <Checkbox checked={isChecked(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Shift ${t.name}`} />
                      <span className="min-w-0 flex-1 truncate">
                        {t.name}
                        {parent && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">🔗 follows {tasks.get(parent)?.name}</span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {short(t.startDate)}–{short(t.endDate)}
                        {next && <> → {short(next.startDate)}–{short(next.endDate)}</>}
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
