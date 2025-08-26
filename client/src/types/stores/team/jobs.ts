import type { Job, JobsByStatus } from '@/types/jobs';

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
    hasJobForTrajectory: (trajectoryId: string) => boolean;
    getJobsForTrajectory: (trajectoryId: string) => JobsByStatus;
    _getCurrentActiveSession: (trajectoryJobs: Job[], expiredSessions: Set<string>) => string | null;
    _initializeSocket: () => void;
    _handleConnect: (connected: boolean) => void;
    _handleTeamJobs: (initialJobs: Job[]) => void;
    _handleJobUpdate: (updatedJob: any) => void;
}

export type TeamJobsStore = TeamJobsState & TeamJobsActions;