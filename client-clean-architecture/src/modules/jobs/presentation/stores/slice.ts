import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { TrajectoryJobGroup, Job } from '../../domain/entities/Job';
import { getJobsUseCases } from '../../application/registry';
import type { JobsUseCases } from '../../application/registry';
import { JobStatusComputeService } from '../../domain/services/JobStatusComputeService';

export interface JobState {
    groups: TrajectoryJobGroup[];
    isConnected: boolean;
    isLoading: boolean;
    expiredSessions: Set<string>;
    currentTeamId: string | null;
}

export interface JobActions {
    initializeJobSocket: () => void;
    subscribeToTeamJobs: (teamId: string, previousTeamId?: string | null) => void;
    unsubscribeFromTeamJobs: () => void;
    disconnectJobSocket: () => void;
    removeTrajectoryGroup: (trajectoryId: string) => void;
}

export type JobSlice = JobState & JobActions;

const jobStatusService = new JobStatusComputeService();

export const initialState: JobState = {
    groups: [],
    isConnected: false,
    isLoading: true,
    expiredSessions: new Set<string>(),
    currentTeamId: null
};

const resolveUseCases = (): JobsUseCases => getJobsUseCases();

export const createJobSlice: SliceCreator<JobSlice> = (set, get) => {
    let connectionUnsubscribe: (() => void) | null = null;
    let teamJobsUnsubscribe: (() => void) | null = null;
    let jobUpdateUnsubscribe: (() => void) | null = null;
    let isSocketInitialized = false;

    const handleJobUpdate = (updatedJob: any) => {
        const { groups, expiredSessions, currentTeamId } = get();
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

        const newGroups = groups.map((g, i) => {
            if (i !== trajIndex) return g;
            const frameIndex = g.frameGroups.findIndex(f => f.timestep === timestep);
            let newFrameGroups;

            if (frameIndex === -1) {
                newFrameGroups = [
                    { timestep, jobs: [updatedJob], overallStatus: 'running' as const },
                    ...g.frameGroups
                ];
            } else {
                newFrameGroups = g.frameGroups.map((f, fi) => {
                    if (fi !== frameIndex) return f;
                    const jobIndex = f.jobs.findIndex(j => j.jobId === updatedJob.jobId);
                    const newJobs = jobIndex >= 0
                        ? f.jobs.map((j, ji) => ji === jobIndex ? { ...j, ...updatedJob } : j)
                        : [updatedJob, ...f.jobs];
                    return {
                        ...f,
                        jobs: newJobs,
                        overallStatus: jobStatusService.computeStatus(newJobs)
                    };
                });
            }

            const allJobs = newFrameGroups.flatMap(f => f.jobs);
            return {
                ...g,
                frameGroups: newFrameGroups,
                overallStatus: jobStatusService.computeStatus(allJobs),
                completedCount: jobStatusService.countCompleted(allJobs),
                totalCount: allJobs.length,
                latestTimestamp: updatedJob.timestamp || g.latestTimestamp
            };
        });

        set({ groups: newGroups });
    };

    return {
        ...initialState,

        initializeJobSocket: () => {
            const { initializeJobSocketUseCase, subscribeToTeamJobsUseCase } = resolveUseCases();
            if (isSocketInitialized) {
                const activeTeamId = get().currentTeamId;
                if (activeTeamId) {
                    subscribeToTeamJobsUseCase
                        .execute(activeTeamId, activeTeamId)
                        .catch(() => set({ isLoading: false }));
                }
                return;
            }

            const init = initializeJobSocketUseCase.execute({
                onConnectionChange: (connected) => {
                    set({ isConnected: connected });
                },
                onInitialJobs: (groups: TrajectoryJobGroup[]) => {
                    set({ groups, isLoading: false });
                },
                onJobUpdated: handleJobUpdate,
                onConnectError: () => {
                    set({ isLoading: false });
                },
                getCurrentTeamId: () => get().currentTeamId
            });

            connectionUnsubscribe = init.subscriptions.offConnection;
            teamJobsUnsubscribe = init.subscriptions.offInitialJobs;
            jobUpdateUnsubscribe = init.subscriptions.offJobUpdated;
            isSocketInitialized = true;
            set({ isConnected: init.isConnected });
        },

        subscribeToTeamJobs: (teamId, previousTeamId = null) => {
            const { subscribeToTeamJobsUseCase } = resolveUseCases();
            const { currentTeamId } = get();
            if (currentTeamId === teamId) return;
            get().initializeJobSocket();
            set({ currentTeamId: teamId, groups: [], expiredSessions: new Set(), isLoading: true });
            subscribeToTeamJobsUseCase
                .execute(teamId, previousTeamId || currentTeamId)
                .catch(() => set({ isLoading: false }));
        },

        unsubscribeFromTeamJobs: () => {
            if (!get().currentTeamId) return;
            set({ currentTeamId: null, groups: [], expiredSessions: new Set(), isLoading: true });
        },

        disconnectJobSocket: () => {
            const { disconnectJobSocketUseCase } = resolveUseCases();
            if (connectionUnsubscribe) { connectionUnsubscribe(); connectionUnsubscribe = null; }
            if (teamJobsUnsubscribe) { teamJobsUnsubscribe(); teamJobsUnsubscribe = null; }
            if (jobUpdateUnsubscribe) { jobUpdateUnsubscribe(); jobUpdateUnsubscribe = null; }
            isSocketInitialized = false;
            disconnectJobSocketUseCase.execute();
            set({ isConnected: false, currentTeamId: null, groups: [], expiredSessions: new Set(), isLoading: true });
        },

        removeTrajectoryGroup: (trajectoryId) => {
            set((state) => ({
                groups: state.groups.filter(g => g.trajectoryId !== trajectoryId)
            }));
        }
    };
};
