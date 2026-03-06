import { create } from 'zustand';
import type { TrajectoryJobGroup } from '@/modules/jobs/domain/entities/Job';

interface TeamJobsStore {
    groups: TrajectoryJobGroup[];
    isConnected: boolean;
    isLoading: boolean;
    expiredSessions: Set<string>;
    currentTeamId: string | null;
    setGroups: (groups: TrajectoryJobGroup[]) => void;
    setConnected: (isConnected: boolean) => void;
    setLoading: (isLoading: boolean) => void;
    setExpiredSessions: (expiredSessions: Set<string>) => void;
    setCurrentTeamId: (currentTeamId: string | null) => void;
    removeTrajectoryGroup: (trajectoryId: string) => void;
    reset: () => void;
}

const createInitialState = () => ({
    groups: [] as TrajectoryJobGroup[],
    isConnected: false,
    isLoading: false,
    expiredSessions: new Set<string>(),
    currentTeamId: null as string | null
});

const useTeamJobsStore = create<TeamJobsStore>((set) => ({
    ...createInitialState(),
    setGroups: (groups) => set({ groups }),
    setConnected: (isConnected) => set({ isConnected }),
    setLoading: (isLoading) => set({ isLoading }),
    setExpiredSessions: (expiredSessions) => set({ expiredSessions }),
    setCurrentTeamId: (currentTeamId) => set({ currentTeamId }),
    removeTrajectoryGroup: (trajectoryId) => set((state) => ({
        groups: state.groups.filter((group) => group.trajectoryId !== trajectoryId)
    })),
    reset: () => set(createInitialState())
}));

export default useTeamJobsStore;
