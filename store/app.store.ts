import { create } from 'zustand';

type ScorekeeperSession = {
  active: boolean;
  pin: string | null;
  tournamentId: string | null;
};

type AppState = {
  scorekeeper: ScorekeeperSession;
  setScorekeeperSession: (pin: string, tournamentId: string) => void;
  clearScorekeeperSession: () => void;
};

const initialSession: ScorekeeperSession = {
  active: false,
  pin: null,
  tournamentId: null,
};

export const useAppStore = create<AppState>((set) => ({
  scorekeeper: initialSession,
  setScorekeeperSession: (pin, tournamentId) =>
    set({
      scorekeeper: {
        active: true,
        pin,
        tournamentId,
      },
    }),
  clearScorekeeperSession: () => set({ scorekeeper: initialSession }),
}));
