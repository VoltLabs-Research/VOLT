import { create } from 'zustand';
import { socketService } from '@/services/websockets/socketio';
import type { TrajectoryJobGroup, FrameJobGroupStatus, Job } from '@/types/jobs';
import type { TeamJobsStore } from '@/types/stores/team/jobs';
import { useTrajectoryStore } from '@/stores/slices/trajectory';

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
    let isSocketInitialized = false;

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
                const newOverallStatus = computeStatus(allJobs);
                const previousOverallStatus = g.overallStatus;

                // Sync with trajectory store when all jobs complete
                if (newOverallStatus === 'completed' && previousOverallStatus !== 'completed') {
                    // Update trajectory status in trajectory store
                    useTrajectoryStore.setState((state) => {
                        const existing = state.trajectories.find((t: any) => t._id === trajId);
                        if (!existing) return state;

                        const nextTrajectories = [
                            { ...existing, status: 'completed', updatedAt: updatedJob.timestamp || new Date().toISOString() },
                            ...state.trajectories.filter((t: any) => t._id !== trajId)
                        ];

                        const nextCurrent = state.trajectory?._id === trajId
                            ? { ...state.trajectory, status: 'completed', updatedAt: updatedJob.timestamp || new Date().toISOString() }
                            : state.trajectory;

                        return {
                            trajectories: nextTrajectories,
                            trajectory: nextCurrent
                        };
                    });
                }

                return {
                    ...g,
                    frameGroups: newFrameGroups,
                    overallStatus: newOverallStatus,
                    completedCount: allJobs.filter(j => j.status === 'completed').length,
                    totalCount: allJobs.length,
                    latestTimestamp: updatedJob.timestamp || g.latestTimestamp
                };
            });

            set({ groups: newGroups });
        },

        _initializeSocket: () => {
            // Only initialize socket listeners once per session
            if (isSocketInitialized) {
                // Just ensure connection is active
                if (!socketService.isConnected()) {
                    socketService.connect().catch(() => set({ isLoading: false }));
                } else {
                    set({ isConnected: true });
                }
                return;
            }

            const { _handleConnect, _handleTeamJobs, _handleJobUpdate } = get();

            // Initialize listeners only once
            connectionUnsubscribe = socketService.onConnectionChange(_handleConnect);
            teamJobsUnsubscribe = socketService.on('team_jobs', _handleTeamJobs);
            jobUpdateUnsubscribe = socketService.on('job_update', _handleJobUpdate);
            isSocketInitialized = true;

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
            if (!currentTeamId) return;

            // Only clear state, keep listeners active for the session
            // The socket room will be changed when subscribing to a new team
            set({ currentTeamId: null, groups: [], expiredSessions: new Set(), isLoading: true });
        },

        disconnect: () => {
            // Clean up all socket listeners on logout/disconnect
            if (connectionUnsubscribe) { connectionUnsubscribe(); connectionUnsubscribe = null; }
            if (teamJobsUnsubscribe) { teamJobsUnsubscribe(); teamJobsUnsubscribe = null; }
            if (jobUpdateUnsubscribe) { jobUpdateUnsubscribe(); jobUpdateUnsubscribe = null; }
            isSocketInitialized = false;
            socketService.disconnect();
            set({ isConnected: false, currentTeamId: null, groups: [], expiredSessions: new Set(), isLoading: true });
        }
    };
});

export default useTeamJobsStore;

