import { create } from 'zustand';

interface TeamJobsStore {
    isConnected: boolean;
    isLoading: boolean;
    currentTeamId: string | null;
    latestAppliedRevision: number;
    requestedRasterTrajectoryIds: Set<string>;
    setConnected: (isConnected: boolean) => void;
    setLoading: (isLoading: boolean) => void;
    setCurrentTeamId: (currentTeamId: string | null) => void;
    setLatestAppliedRevision: (latestAppliedRevision: number) => void;
    setRequestedRasterTrajectoryIds: (trajectoryIds: Set<string>) => void;
    reset: () => void;
};

interface TeamJobsState {
    isConnected: boolean;
    isLoading: boolean;
    currentTeamId: string | null;
    latestAppliedRevision: number;
    requestedRasterTrajectoryIds: Set<string>;
};

const createInitialState = (): TeamJobsState => ({
    isConnected: false,
    isLoading: false,
    currentTeamId: null,
    latestAppliedRevision: 0,
    requestedRasterTrajectoryIds: new Set<string>()
});

const useTeamJobsStore = create<TeamJobsStore>((set) => ({
    ...createInitialState(),
    setConnected: (isConnected) => set({ isConnected }),
    setLoading: (isLoading) => set({ isLoading }),
    setCurrentTeamId: (currentTeamId) => set({ currentTeamId }),
    setLatestAppliedRevision: (latestAppliedRevision) => set({ latestAppliedRevision }),
    setRequestedRasterTrajectoryIds: (requestedRasterTrajectoryIds) => set({ requestedRasterTrajectoryIds }),
    reset: () => set(createInitialState())
}));

export default useTeamJobsStore;
