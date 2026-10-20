import { create } from 'zustand';

interface TeamJobsStore {
    isConnected: boolean;
    isLoading: boolean;
    currentTeamId: string | null;
    latestAppliedRevision: number;
    setConnected: (isConnected: boolean) => void;
    setLoading: (isLoading: boolean) => void;
    setCurrentTeamId: (currentTeamId: string | null) => void;
    setLatestAppliedRevision: (latestAppliedRevision: number) => void;
    reset: () => void;
};

interface TeamJobsState {
    isConnected: boolean;
    isLoading: boolean;
    currentTeamId: string | null;
    latestAppliedRevision: number;
};

const createInitialState = (): TeamJobsState => ({
    isConnected: false,
    isLoading: false,
    currentTeamId: null,
    latestAppliedRevision: 0,
});

const useTeamJobsStore = create<TeamJobsStore>((set) => ({
    ...createInitialState(),
    setConnected: (isConnected) => set({ isConnected }),
    setLoading: (isLoading) => set({ isLoading }),
    setCurrentTeamId: (currentTeamId) => set({ currentTeamId }),
    setLatestAppliedRevision: (latestAppliedRevision) => set({ latestAppliedRevision }),
    reset: () => set(createInitialState())
}));

export default useTeamJobsStore;
