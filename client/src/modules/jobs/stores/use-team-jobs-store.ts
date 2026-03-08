import { create } from 'zustand';
export { TEAM_JOBS_QUERY_KEYS } from '../hooks/queries';

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
}

const createInitialState = () => ({
    isConnected: false,
    isLoading: false,
    expiredSessions: new Set<string>(),
    currentTeamId: null as string | null
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
