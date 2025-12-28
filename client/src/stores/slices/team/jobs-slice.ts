import { create } from 'zustand';
import { socketService } from '@/services/websockets/socketio';
import Logger from '@/services/common/logger';
import type { Job } from '@/types/jobs';
import { sortJobsByTimestamp } from '@/utilities/common/jobs';
import type { TeamJobsStore } from '@/types/stores/team/jobs';

const initialState = {
    jobs: [] as Job[],
    isConnected: false,
    isLoading: true,
    expiredSessions: new Set<string>(),
    currentTeamId: null as string | null
};

const useTeamJobsStore = create<TeamJobsStore>()((set, get) => {
    const logger = new Logger('use-team-job-store');
    let connectionUnsubscribe: (() => void) | null = null;
    let teamJobsUnsubscribe: (() => void) | null = null;
    let jobUpdateUnsubscribe: (() => void) | null = null;

    return {
        ...initialState,

        _handleConnect: (connected: boolean) => {
            logger.log('Socket connection status:', connected);
            set({ isConnected: connected });
            if (!connected) return;
            const { currentTeamId } = get();
            if (currentTeamId) socketService.subscribeToTeam(currentTeamId);
        },

        _handleTeamJobs: (initialJobs: Job[]) => {
            set({ jobs: sortJobsByTimestamp(initialJobs), isLoading: false });
        },

        _handleJobUpdate: (updatedJob: any) => {
            const { jobs, expiredSessions } = get();
            if (updatedJob.type === 'session_expired') {
                const newExpiredSessions = new Set(expiredSessions);
                newExpiredSessions.add(updatedJob.sessionId);
                set({ expiredSessions: newExpiredSessions });
                return;
            }
            const jobExists = jobs.some((job) => job.jobId === updatedJob.jobId);
            const newJobs = jobExists
                ? jobs.map((job) => job.jobId === updatedJob.jobId ? { ...job, ...updatedJob } : job)
                : [...jobs, updatedJob];
            set({ jobs: sortJobsByTimestamp(newJobs) });
        },

        _initializeSocket: () => {
            const { _handleConnect, _handleTeamJobs, _handleJobUpdate } = get();
            if (connectionUnsubscribe) connectionUnsubscribe();
            if (teamJobsUnsubscribe) teamJobsUnsubscribe();
            if (jobUpdateUnsubscribe) jobUpdateUnsubscribe();
            connectionUnsubscribe = socketService.onConnectionChange(_handleConnect);
            teamJobsUnsubscribe = socketService.on('team_jobs', _handleTeamJobs);
            jobUpdateUnsubscribe = socketService.on('job_update', _handleJobUpdate);
            if (!socketService.isConnected()) {
                socketService.connect().catch(() => set({ isLoading: false }));
            } else {
                set({ isConnected: true });
            }
        },

        subscribeToTeam: (teamId, previousTeamId = null) => {
            const { currentTeamId, _initializeSocket } = get();
            if (currentTeamId === teamId) return;
            _initializeSocket();
            set({ currentTeamId: teamId, jobs: [], expiredSessions: new Set(), isLoading: true });
            if (!socketService.isConnected()) {
                socketService.connect().then(() => socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId!)).catch(() => set({ isLoading: false }));
            } else {
                socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId!);
            }
        },

        unsubscribeFromTeam: () => {
            const { currentTeamId } = get();
            if (currentTeamId) set({ currentTeamId: null, jobs: [], expiredSessions: new Set(), isLoading: true });
        },

        disconnect: () => {
            if (connectionUnsubscribe) { connectionUnsubscribe(); connectionUnsubscribe = null; }
            if (teamJobsUnsubscribe) { teamJobsUnsubscribe(); teamJobsUnsubscribe = null; }
            if (jobUpdateUnsubscribe) { jobUpdateUnsubscribe(); jobUpdateUnsubscribe = null; }
            socketService.disconnect();
            set({ isConnected: false, currentTeamId: null, jobs: [], expiredSessions: new Set(), isLoading: true });
        }
    };
});

export default useTeamJobsStore;
