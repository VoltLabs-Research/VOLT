import { create } from 'zustand';
import { socketService } from '@/services/websockets/socketio';
import type { TrajectoryJobGroup, FrameJobGroupStatus, Job } from '@/types/jobs';
import type { TeamJobsStore } from '@/types/stores/team/jobs';

const initialState = {
    groups: [] as TrajectoryJobGroup[],
    isConnected: false,
    isLoading: true,
    expiredSessions: new Set<string>(),
    currentTeamId: null as string | null
};

const useTeamJobsStore = create<TeamJobsStore>()((set, get) => {
    let connectionUnsubscribe: (() => void) | null = null;
    let teamJobsUnsubscribe: (() => void) | null = null;
    let jobUpdateUnsubscribe: (() => void) | null = null;

    const computeStatus = (jobs: Job[]): FrameJobGroupStatus => {
        const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'queued');
        const hasFailed = jobs.some(j => j.status === 'failed');
        const allCompleted = jobs.every(j => j.status === 'completed');
        if (hasRunning) return 'running';
        if (allCompleted) return 'completed';
        if (hasFailed && jobs.filter(j => j.status === 'completed').length === 0) return 'failed';
        return 'partial';
    };

    return {
        ...initialState,

        _handleConnect: (connected: boolean) => {
            set({ isConnected: connected });
            if (!connected) return;
            const { currentTeamId } = get();
            if (currentTeamId) socketService.subscribeToTeam(currentTeamId);
        },

        _handleTeamJobs: (groups: TrajectoryJobGroup[]) => {
            set({ groups, isLoading: false });
        },

        _handleJobUpdate: (updatedJob: any) => {
            const { groups, expiredSessions } = get();
            if (updatedJob.type === 'session_expired') {
                const newExpiredSessions = new Set(expiredSessions);
                newExpiredSessions.add(updatedJob.sessionId);
                set({ expiredSessions: newExpiredSessions });
                return;
            }

            const trajId = updatedJob.trajectoryId;
            const timestep = updatedJob.timestep;
            const trajIndex = groups.findIndex(g => g.trajectoryId === trajId);

            if (trajIndex === -1) {
                // New trajectory - add it
                const newTrajGroup = {
                    trajectoryId: trajId,
                    trajectoryName: updatedJob.message || `Trajectory ${trajId.slice(-6)}`,
                    frameGroups: [{
                        timestep,
                        jobs: [updatedJob],
                        overallStatus: 'running' as const
                    }],
                    latestTimestamp: updatedJob.timestamp || new Date().toISOString(),
                    overallStatus: 'running' as const,
                    completedCount: 0,
                    totalCount: 1
                };
                set({ groups: [newTrajGroup, ...groups] });
                return;
            }

            // Create new array with new trajectory object
            const newGroups = groups.map((g, i) => {
                if (i !== trajIndex) return g;

                const frameIndex = g.frameGroups.findIndex(f => f.timestep === timestep);
                let newFrameGroups;

                if (frameIndex === -1) {
                    // New frame
                    newFrameGroups = [
                        { timestep, jobs: [updatedJob], overallStatus: 'running' as const },
                        ...g.frameGroups
                    ];
                } else {
                    // Update existing frame
                    newFrameGroups = g.frameGroups.map((f, fi) => {
                        if (fi !== frameIndex) return f;

                        const jobIndex = f.jobs.findIndex(j => j.jobId === updatedJob.jobId);
                        const newJobs = jobIndex >= 0
                            ? f.jobs.map((j, ji) => ji === jobIndex ? { ...j, ...updatedJob } : j)
                            : [updatedJob, ...f.jobs];

                        return {
                            ...f,
                            jobs: newJobs,
                            overallStatus: computeStatus(newJobs)
                        };
                    });
                }

                const allJobs = newFrameGroups.flatMap(f => f.jobs);
                return {
                    ...g,
                    frameGroups: newFrameGroups,
                    overallStatus: computeStatus(allJobs),
                    completedCount: allJobs.filter(j => j.status === 'completed').length,
                    totalCount: allJobs.length,
                    latestTimestamp: updatedJob.timestamp || g.latestTimestamp
                };
            });

            set({ groups: newGroups });
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
            set({ currentTeamId: teamId, groups: [], expiredSessions: new Set(), isLoading: true });
            if (!socketService.isConnected()) {
                socketService.connect().then(() => socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId!)).catch(() => set({ isLoading: false }));
            } else {
                socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId!);
            }
        },

        unsubscribeFromTeam: () => {
            const { currentTeamId } = get();
            if (currentTeamId) set({ currentTeamId: null, groups: [], expiredSessions: new Set(), isLoading: true });
        },

        disconnect: () => {
            if (connectionUnsubscribe) { connectionUnsubscribe(); connectionUnsubscribe = null; }
            if (teamJobsUnsubscribe) { teamJobsUnsubscribe(); teamJobsUnsubscribe = null; }
            if (jobUpdateUnsubscribe) { jobUpdateUnsubscribe(); jobUpdateUnsubscribe = null; }
            socketService.disconnect();
            set({ isConnected: false, currentTeamId: null, groups: [], expiredSessions: new Set(), isLoading: true });
        }
    };
});

export default useTeamJobsStore;

