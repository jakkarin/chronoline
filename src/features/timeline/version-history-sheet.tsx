import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { History, MoreHorizontal, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useTimelineStore } from '@/store/timeline-store';
import { versionsRepo } from '@/lib/db/versions';
import type { TimelineVersion } from '@/lib/types';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistorySheet({ open, onOpenChange }: Props) {
  const timelineId = useTimelineStore((s) => s.timeline?.id);
  const editorSession = useTimelineStore((s) => s.editorSession);
  const restoreVersion = useTimelineStore((s) => s.restoreVersion);
  const renameVersion = useTimelineStore((s) => s.renameVersion);
  const deleteVersion = useTimelineStore((s) => s.deleteVersion);
  const [versions, setVersions] = useState<TimelineVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TimelineVersion | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<TimelineVersion | null>(null);
  const [backupFirst, setBackupFirst] = useState(true);

  const refresh = useCallback(async () => {
    if (!timelineId) return;

    if (editorSession?.mode === 'file') {
      setVersions(editorSession.versions);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const list = await versionsRepo.list(timelineId);
      setVersions(list);
    } finally {
      setLoading(false);
    }
  }, [editorSession, timelineId]);

  useEffect(() => {
    if (open) {
      // Sync with external `open` prop to load versions when sheet is shown.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refresh();
    }
  }, [open, refresh]);

  async function handleRename(id: string) {
    const trimmed = renameVal.trim();
    if (trimmed) {
      await renameVersion(id, trimmed);
      await refresh();
    }
    setRenamingId(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteVersion(deleteTarget.id);
    setDeleteTarget(null);
    await refresh();
    toast.success('Version deleted');
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setRestoreTarget(null);
    try {
      await restoreVersion(target.id, backupFirst);
      toast.success(`Restored "${target.name}"`);
      onOpenChange(false);
    } catch (err) {
      toast.error('Restore failed: ' + (err as Error).message);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-96 sm:max-w-96">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Version History
              <span className="text-xs font-normal text-muted-foreground ml-auto">
                {versions.length} {versions.length === 1 ? 'version' : 'versions'}
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 px-4 pb-4 overflow-y-auto flex flex-col gap-2">
            {loading && versions.length === 0 && (
              <p className="text-xs text-muted-foreground py-8 text-center">Loading…</p>
            )}

            {!loading && versions.length === 0 && (
              <div className="py-12 text-center">
                <History className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mt-3">No versions yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Click <span className="font-medium">Save Version</span> in the toolbar to create one.
                </p>
              </div>
            )}

            {versions.map((v) => (
              <div
                key={v.id}
                className="rounded-lg border border-border p-3 hover:border-border/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {renamingId === v.id ? (
                      <Input
                        autoFocus
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onBlur={() => handleRename(v.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(v.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <h4 className="text-sm font-medium truncate">{v.name}</h4>
                    )}
                    <p
                      className="text-xs text-muted-foreground mt-0.5"
                      title={format(new Date(v.createdAt), 'PPpp')}
                    >
                      {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex h-6 w-6 items-center justify-center rounded shrink-0 hover:bg-accent text-muted-foreground"
                      aria-label="Version actions"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameVal(v.name);
                          setRenamingId(v.id);
                        }}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget(v)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="text-xs text-muted-foreground mt-1.5">
                  {v.stats.projectCount} {v.stats.projectCount === 1 ? 'project' : 'projects'}
                  {' · '}
                  {v.stats.taskCount} {v.stats.taskCount === 1 ? 'task' : 'tasks'}
                </p>

                {v.note && (
                  <p className="text-xs text-muted-foreground/90 mt-1.5 whitespace-pre-wrap wrap-break-word">
                    {v.note}
                  </p>
                )}

                <div className="mt-2.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 w-full"
                    onClick={() => {
                      setBackupFirst(true);
                      setRestoreTarget(v);
                    }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore &quot;{restoreTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite your current timeline. Undo history will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={backupFirst}
              onChange={(e) => setBackupFirst(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Save current state as backup version first
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete version "${deleteTarget?.name ?? ''}"?`}
        description="This cannot be undone."
        onConfirm={handleDelete}
      />
    </>
  );
}
