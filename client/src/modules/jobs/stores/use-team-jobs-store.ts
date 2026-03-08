import { create } from 'zustand';
export { TEAM_JOBS_QUERY_KEYS } from '../utilities/query-keys';

interface TeamJobsStore {
    isConnected: boolean;
    isLoading: boolean;
    expiredSessions: Set<string>;
    currentTeamId: string | null;
    setConnected: (isConnected: boolean) => void;
    setLoading: (isLoading: boolean) => void;
    setExpiredSessions: (expiredSessions: Set<string>) => void;
    setCurrentTeamId: (currentTeamId: string | null) => void;
    reset: () => void;
};

interface TeamJobsState {
    isConnected: boolean;
    isLoading: boolean;
    expiredSessions: Set<string>;
    currentTeamId: string | null;
};

const createInitialState = (): TeamJobsState => ({
    isConnected: false,
    isLoading: false,
    expiredSessions: new Set<string>(),
    currentTeamId: null
});

const useTeamJobsStore = create<TeamJobsStore>((set) => ({
    ...createInitialState(),
    setConnected: (isConnected) => set({ isConnected }),
    setLoading: (isLoading) => set({ isLoading }),
    setExpiredSessions: (expiredSessions) => set({ expiredSessions }),
    setCurrentTeamId: (currentTeamId) => set({ currentTeamId }),
    reset: () => set(createInitialState())
}));

export default useTeamJobsStore;
