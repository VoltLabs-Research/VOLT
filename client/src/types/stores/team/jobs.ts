import type { Job } from '@/types/jobs';

export interface TeamJobsState{
    jobs: Job[];
    isConnected: boolean;
    isLoading: boolean;
    expiredSessions: Set<string>;
    currentTeamId: string | null;
}

export interface TeamJobsActions{
    subscribeToTeam: (teamId: string, previousTeamId?: string | null) => void;
    unsubscribeFromTeam: () => void;
    disconnect: () => void;
    _initializeSocket: () => void;
    _handleConnect: (connected: boolean) => void;
    _handleTeamJobs: (initialJobs: Job[]) => void;
    _handleJobUpdate: (updatedJob: any) => void;
}

export type TeamJobsStore = TeamJobsState & TeamJobsActions;
