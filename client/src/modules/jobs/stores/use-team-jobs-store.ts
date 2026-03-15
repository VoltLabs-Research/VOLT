import { create } from 'zustand';
export { TEAM_JOBS_QUERY_KEYS } from '../utilities/query-keys';

interface TeamJobsStore {
    isConnected: boolean;
    isLoading: boolean;
    currentTeamId: string | null;
    pendingRasterKeys: Set<string>;
    inFlightRasterTrajectoryIds: Set<string>;
    setConnected: (isConnected: boolean) => void;
    setLoading: (isLoading: boolean) => void;
    setCurrentTeamId: (currentTeamId: string | null) => void;
    setPendingRasterKeys: (pendingRasterKeys: Set<string>) => void;
    setInFlightRasterTrajectoryIds: (trajectoryIds: Set<string>) => void;
    reset: () => void;
};

interface TeamJobsState {
    isConnected: boolean;
    isLoading: boolean;
    currentTeamId: string | null;
    pendingRasterKeys: Set<string>;
    inFlightRasterTrajectoryIds: Set<string>;
};

const createInitialState = (): TeamJobsState => ({
    isConnected: false,
    isLoading: false,
    currentTeamId: null,
    pendingRasterKeys: new Set<string>(),
    inFlightRasterTrajectoryIds: new Set<string>()
});

const useTeamJobsStore = create<TeamJobsStore>((set) => ({
    ...createInitialState(),
    setConnected: (isConnected) => set({ isConnected }),
    setLoading: (isLoading) => set({ isLoading }),
    setCurrentTeamId: (currentTeamId) => set({ currentTeamId }),
    setPendingRasterKeys: (pendingRasterKeys) => set({ pendingRasterKeys }),
    setInFlightRasterTrajectoryIds: (inFlightRasterTrajectoryIds) => set({ inFlightRasterTrajectoryIds }),
    reset: () => set(createInitialState())
}));

export default useTeamJobsStore;
