import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTimelineStore } from '@/store/timeline-store';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

function defaultName() {
  return `Version ${new Date().toLocaleString()}`;
}

export function SaveVersionDialog({ open, onOpenChange, onSaved }: Props) {
  const saveVersion = useTimelineStore((s) => s.saveVersion);
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(defaultName());
      setNote('');
    }
    onOpenChange(next);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await saveVersion(trimmed, note);
      toast.success(`Saved version "${trimmed}"`);
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error('Save failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Version</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ver-name">Name</Label>
            <Input
              id="ver-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. v1.0 baseline"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) handleSave();
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ver-note">Note <span className="text-muted-foreground">(optional)</span></Label>
            <textarea
              id="ver-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What changed in this version?"
              rows={3}
              className="min-h-[72px] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || loading}>Save Version</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
