import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Pencil, Copy, Download, Trash2, FolderOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { TimelineMeta } from '@/lib/types';
import { timelineRepo } from '@/lib/db/timelines';
import { exportJSON } from '@/features/io/export-json';

interface Props {
  meta: TimelineMeta;
  onRefresh: () => void;
}

export function TimelineCard({ meta, onRefresh }: Props) {
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(meta.title);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleRename() {
    if (renameVal.trim() && renameVal.trim() !== meta.title) {
      await timelineRepo.update(meta.id, { title: renameVal.trim() });
      onRefresh();
    }
    setRenaming(false);
  }

  async function handleDuplicate() {
    await timelineRepo.duplicate(meta.id);
    onRefresh();
  }

  async function handleExportJSON() {
    const tl = await timelineRepo.get(meta.id);
    if (tl) exportJSON(tl);
  }

  async function handleDelete() {
    await timelineRepo.delete(meta.id);
    onRefresh();
  }

  const progress =
    meta.taskCount > 0
      ? Math.round(
          ((meta as TimelineMeta & { doneCount?: number }).doneCount ?? 0) / meta.taskCount * 100
        )
      : 0;

  return (
    <>
      <Card
        className="group cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => !renaming && navigate(`/timeline/${meta.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {renaming ? (
                <Input
                  autoFocus
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') setRenaming(false);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-sm font-semibold"
                />
              ) : (
                <h3 className="font-semibold text-sm truncate">{meta.title}</h3>
              )}
              {meta.customer && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{meta.customer}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0 hover:bg-accent"
                onClick={(e) => e.stopPropagation()}
                aria-label="Timeline actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/timeline/${meta.id}`); }}>
                  <FolderOpen className="mr-2 h-4 w-4" /> Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameVal(meta.title); setRenaming(true); }}>
                  <Pencil className="mr-2 h-4 w-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(); }}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleExportJSON(); }}>
                  <Download className="mr-2 h-4 w-4" /> Export JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{meta.startDate}</span>
            <span>·</span>
            <span>{meta.projectCount}P / {meta.taskCount}T</span>
          </div>

          <div className="mt-2">
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Updated {formatDistanceToNow(new Date(meta.updatedAt), { addSuffix: true })}
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${meta.title}"?`}
        description="This will permanently delete the timeline and all its data."
        onConfirm={handleDelete}
      />
    </>
  );
}
