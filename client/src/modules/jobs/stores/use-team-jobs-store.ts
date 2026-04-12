import { create } from 'zustand';
export { TEAM_JOBS_QUERY_KEYS } from '../utilities/query-keys';

interface TeamJobsStore {
    isConnected: boolean;
    isLoading: boolean;
    currentTeamId: string | null;
    requestedRasterTrajectoryIds: Set<string>;
    setConnected: (isConnected: boolean) => void;
    setLoading: (isLoading: boolean) => void;
    setCurrentTeamId: (currentTeamId: string | null) => void;
    setRequestedRasterTrajectoryIds: (trajectoryIds: Set<string>) => void;
    reset: () => void;
};

interface TeamJobsState {
    isConnected: boolean;
    isLoading: boolean;
    currentTeamId: string | null;
    requestedRasterTrajectoryIds: Set<string>;
};

const createInitialState = (): TeamJobsState => ({
    isConnected: false,
    isLoading: false,
    currentTeamId: null,
    requestedRasterTrajectoryIds: new Set<string>()
});

const useTeamJobsStore = create<TeamJobsStore>((set) => ({
    ...createInitialState(),
    setConnected: (isConnected) => set({ isConnected }),
    setLoading: (isLoading) => set({ isLoading }),
    setCurrentTeamId: (currentTeamId) => set({ currentTeamId }),
    setRequestedRasterTrajectoryIds: (requestedRasterTrajectoryIds) => set({ requestedRasterTrajectoryIds }),
    reset: () => set(createInitialState())
}));

export default useTeamJobsStore;
