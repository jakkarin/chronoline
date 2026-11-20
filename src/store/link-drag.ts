import { create } from 'zustand';

/** A link being dragged from a bar's dot to another bar (viewport coords). Transient UI state. */
export interface LinkDrag {
  fromTaskId: string;
  x: number;
  y: number;
}

interface LinkDragStore {
  drag: LinkDrag | null;
  set: (drag: LinkDrag | null) => void;
}

export const useLinkDrag = create<LinkDragStore>()((set) => ({
  drag: null,
  set: (drag) => set({ drag }),
}));
