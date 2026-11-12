import { create } from 'zustand';

interface TeamJobsStore {
    isLoading: boolean;
    currentTeamId: string | null;
    latestAppliedRevision: number;
    setLoading: (isLoading: boolean) => void;
    setCurrentTeamId: (currentTeamId: string | null) => void;
    setLatestAppliedRevision: (latestAppliedRevision: number) => void;
    reset: () => void;
};

interface TeamJobsState {
    isLoading: boolean;
    currentTeamId: string | null;
    latestAppliedRevision: number;
};

const createInitialState = (): TeamJobsState => ({
    isLoading: false,
    currentTeamId: null,
    latestAppliedRevision: 0,
});

const useTeamJobsStore = create<TeamJobsStore>((set) => ({
    ...createInitialState(),
    setLoading: (isLoading) => set({ isLoading }),
    setCurrentTeamId: (currentTeamId) => set({ currentTeamId }),
    setLatestAppliedRevision: (latestAppliedRevision) => set({ latestAppliedRevision }),
    reset: () => set(createInitialState())
}));

export default useTeamJobsStore;
