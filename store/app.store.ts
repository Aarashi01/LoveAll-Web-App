import { create } from 'zustand';

/**
 * Tracks which tournament the active scorekeeper screens belong to.
 * The actual access state lives in Firestore; this is just routing context
 * so the (scorekeeper) layout knows which access doc to subscribe to.
 */
type ScorekeeperContext = {
  tournamentId: string | null;
};

type AppState = {
  scorekeeperCtx: ScorekeeperContext;
  setScorekeeperTournament: (tournamentId: string | null) => void;
  clearScorekeeperContext: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  scorekeeperCtx: { tournamentId: null },
  setScorekeeperTournament: (tournamentId) =>
    set({ scorekeeperCtx: { tournamentId } }),
  clearScorekeeperContext: () => set({ scorekeeperCtx: { tournamentId: null } }),
}));
