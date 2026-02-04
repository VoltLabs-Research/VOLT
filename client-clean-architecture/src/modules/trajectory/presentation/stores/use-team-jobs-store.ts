import { create } from 'zustand';
import { create } from 'zustand';
import type { TrajectoryJobGroup, FrameJobGroupStatus, Job } from '@/shared/domain/jobs';
import type ISocketService from '@/modules/socket/domain/ports/ISocketService';

interface TeamJobsStore {
    groups: TrajectoryJobGroup[];
    isConnected: boolean;
    isLoading: boolean;
    expiredSessions: Set<string>;
    currentTeamId: string | null;

    initializeSocket: (service: ISocketService) => void;
    subscribeToTeam: (teamId: string, previousTeamId?: string | null) => void;
    unsubscribeFromTeam: () => void;
    disconnect: () => void;
    removeTrajectoryGroup: (trajectoryId: string) => void;
}

const initialState = {
    groups: [] as TrajectoryJobGroup[],
    isConnected: false,
    isLoading: true,
    expiredSessions: new Set<string>(),
    currentTeamId: null as string | null
};

const useTeamJobsStore = create<TeamJobsStore>((set, get) => {
    let socketService: ISocketService | null = null;
    let connectionUnsubscribe: (() => void) | null = null;
    let teamJobsUnsubscribe: (() => void) | null = null;
    let jobUpdateUnsubscribe: (() => void) | null = null;
    let isSocketInitialized = false;

    const computeStatus = (jobs: Job[]): FrameJobGroupStatus => {
        const hasRunning = jobs.some((job) => job.status === 'running');
        const hasQueued = jobs.some((job) => job.status === 'queued' || job.status === 'retrying');
        const hasFailed = jobs.some((job) => job.status === 'failed');
        const allCompleted = jobs.every((job) => job.status === 'completed');

        if (hasRunning) return 'running';
        if (hasQueued) return 'queued';
        if (allCompleted) return 'completed';
        if (hasFailed && jobs.filter((job) => job.status === 'completed').length === 0) return 'failed';
        return 'partial';
    };

    const handleConnect = (connected: boolean) => {
        set({ isConnected: connected });
        if (!connected) return;
        const { currentTeamId } = get();
        if (currentTeamId && socketService) socketService.subscribeToTeam(currentTeamId);
    };

    const handleTeamJobs = (groups: TrajectoryJobGroup[]) => {
        set({ groups, isLoading: false });
    };

    const handleJobUpdate = (updatedJob: any) => {
        const { groups, expiredSessions } = get();
        if (updatedJob.type === 'session_expired') {
            const newExpiredSessions = new Set(expiredSessions);
            newExpiredSessions.add(updatedJob.sessionId);
            set({ expiredSessions: newExpiredSessions });
            return;
        }

        const trajId = updatedJob.trajectoryId;
        const timestep = updatedJob.timestep;
        const trajIndex = groups.findIndex((g) => g.trajectoryId === trajId);

        if (trajIndex === -1) {
            const newTrajGroup: TrajectoryJobGroup = {
                trajectoryId: trajId,
                trajectoryName: updatedJob.message || `Trajectory ${trajId.slice(-6)}`,
                frameGroups: [{
                    timestep,
                    jobs: [updatedJob],
                    overallStatus: 'running'
                }],
                latestTimestamp: updatedJob.timestamp || new Date().toISOString(),
                overallStatus: 'running',
                completedCount: 0,
                totalCount: 1
            };
            set({ groups: [newTrajGroup, ...groups] });
            return;
        }

        const newGroups = groups.map((group, i) => {
            if (i !== trajIndex) return group;

            const frameIndex = group.frameGroups.findIndex((f) => f.timestep === timestep);
            let newFrameGroups;

            if (frameIndex === -1) {
                newFrameGroups = [
                    { timestep, jobs: [updatedJob], overallStatus: 'running' },
                    ...group.frameGroups
                ];
            } else {
                newFrameGroups = group.frameGroups.map((f, fi) => {
                    if (fi !== frameIndex) return f;

                    const jobIndex = f.jobs.findIndex((j) => j.jobId === updatedJob.jobId);
                    const newJobs = jobIndex >= 0
                        ? f.jobs.map((j, ji) => (ji === jobIndex ? { ...j, ...updatedJob } : j))
                        : [updatedJob, ...f.jobs];

                    return {
                        ...f,
                        jobs: newJobs,
                        overallStatus: computeStatus(newJobs)
                    };
                });
            }

            const allJobs = newFrameGroups.flatMap((frame) => frame.jobs);
            const newOverallStatus = computeStatus(allJobs);

            return {
                ...group,
                frameGroups: newFrameGroups,
                overallStatus: newOverallStatus,
                completedCount: allJobs.filter((job) => job.status === 'completed').length,
                totalCount: allJobs.length,
                latestTimestamp: updatedJob.timestamp || group.latestTimestamp
            };
        });

        set({ groups: newGroups });
    };

    const initializeSocket = (service: ISocketService) => {
        socketService = service;
        if (isSocketInitialized) {
            if (!socketService.isConnected()) {
                socketService.connect().catch(() => set({ isLoading: false }));
            } else {
                set({ isConnected: true });
            }
            return;
        }

        connectionUnsubscribe = socketService.onConnectionChange(handleConnect);
        teamJobsUnsubscribe = socketService.on('team.jobs.initial', handleTeamJobs);
        jobUpdateUnsubscribe = socketService.on('team.job.updated', handleJobUpdate);
        isSocketInitialized = true;

        if (!socketService.isConnected()) {
            socketService.connect().catch(() => set({ isLoading: false }));
        } else {
            set({ isConnected: true });
        }
    };

    const subscribeToTeam = (teamId: string, previousTeamId: string | null = null) => {
        const { currentTeamId } = get();
        if (!socketService) return;
        if (currentTeamId === teamId) return;
        initializeSocket(socketService);
        set({ currentTeamId: teamId, groups: [], expiredSessions: new Set(), isLoading: true });
        socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId || undefined);
    };

    const unsubscribeFromTeam = () => {
        const { currentTeamId } = get();
        if (!currentTeamId) return;
        set({ currentTeamId: null, groups: [], expiredSessions: new Set(), isLoading: true });
    };

    const disconnect = () => {
        if (connectionUnsubscribe) { connectionUnsubscribe(); connectionUnsubscribe = null; }
        if (teamJobsUnsubscribe) { teamJobsUnsubscribe(); teamJobsUnsubscribe = null; }
        if (jobUpdateUnsubscribe) { jobUpdateUnsubscribe(); jobUpdateUnsubscribe = null; }
        isSocketInitialized = false;
        socketService?.disconnect();
        set({ isConnected: false, currentTeamId: null, groups: [], expiredSessions: new Set(), isLoading: true });
    };

    const removeTrajectoryGroup = (trajectoryId: string) => {
        const { groups } = get();
        const newGroups = groups.filter((g) => g.trajectoryId !== trajectoryId);
        set({ groups: newGroups });
    };

    return {
        ...initialState,
        initializeSocket,
        subscribeToTeam,
        unsubscribeFromTeam,
        disconnect,
        removeTrajectoryGroup
    };
});

export default useTeamJobsStore;
