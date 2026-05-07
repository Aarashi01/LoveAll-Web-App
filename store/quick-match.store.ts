import { create } from 'zustand';

import {
  applyPoint,
  createMatch,
  undoLastPoint,
  type QuickFormat,
  type QuickMatch,
  type QuickRules,
  type Side,
} from '@/lib/quick-match-engine';

interface QuickMatchState {
  match: QuickMatch | null;
  startMatch: (input: {
    format: QuickFormat;
    sideAName: string;
    sideBName: string;
    rules: QuickRules;
  }) => void;
  scorePoint: (side: Side) => void;
  undo: () => void;
  rematch: () => void;
  reset: () => void;
}

export const useQuickMatchStore = create<QuickMatchState>((set, get) => ({
  match: null,
  startMatch: (input) => set({ match: createMatch(input) }),
  scorePoint: (side) => {
    const cur = get().match;
    if (!cur) return;
    set({ match: applyPoint(cur, side) });
  },
  undo: () => {
    const cur = get().match;
    if (!cur) return;
    set({ match: undoLastPoint(cur) });
  },
  rematch: () => {
    const cur = get().match;
    if (!cur) return;
    set({
      match: createMatch({
        format: cur.format,
        sideAName: cur.sideAName,
        sideBName: cur.sideBName,
        rules: cur.rules,
      }),
    });
  },
  reset: () => set({ match: null }),
}));
