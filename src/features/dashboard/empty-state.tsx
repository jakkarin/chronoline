import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onNew: () => void;
}

export function EmptyState({ onNew }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-full bg-muted p-5 mb-4">
        <CalendarDays className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">No timelines yet</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Create your first timeline to get started.
      </p>
      <Button onClick={onNew}>+ New Timeline</Button>
    </div>
  );
}
