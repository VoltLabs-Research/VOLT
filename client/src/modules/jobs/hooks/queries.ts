import { JobStatus } from '../api/entities/job';
import { computeGroupStatus } from '../utilities/job-group-updates';
import { TEAM_JOBS_QUERY_KEYS } from '../utilities/query-keys';
import service from '../api/service';
import { createSocketQuery, withSuccess } from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
import useTeamJobsStore from '../stores/use-team-jobs-store';
import { useMutation } from '@tanstack/react-query';
import type { FrameJobGroup, Job, TrajectoryJobGroup } from '../api/entities/job';
import type {
    RemoveRunningJobsOutputDTO,
    RemoveRunningJobsParams,
    RetryFailedJobsOutputDTO,
    RetryFailedJobsParams
} from '../api/service';
import type { MutationOptions } from '@/shared/infrastructure/query';
import type { QueryClient } from '@tanstack/react-query';

export interface TeamJobsMutationContext {
    previousGroups: TrajectoryJobGroup[];
};

const getActiveQueryClient = (client?: QueryClient): QueryClient => client ?? queryClient;

export const teamJobsGroups = createSocketQuery<void, TrajectoryJobGroup[]>(TEAM_JOBS_QUERY_KEYS.groups, {
    initialData: []
});

export const getTeamJobsGroupsQueryData = (client?: QueryClient): TrajectoryJobGroup[] => {
    return getActiveQueryClient(client).getQueryData<TrajectoryJobGroup[]>(TEAM_JOBS_QUERY_KEYS.groups()) ?? [];
};

export const setTeamJobsGroupsQueryData = (
    groups: TrajectoryJobGroup[],
    client?: QueryClient
): void => {
    getActiveQueryClient(client).setQueryData<TrajectoryJobGroup[]>(TEAM_JOBS_QUERY_KEYS.groups(), groups);
};

export const updateTeamJobsGroupsQueryData = (
    updater: (groups: TrajectoryJobGroup[]) => TrajectoryJobGroup[],
    client?: QueryClient
): void => {
    const activeQueryClient = getActiveQueryClient(client);

    activeQueryClient.setQueryData<TrajectoryJobGroup[]>(
        TEAM_JOBS_QUERY_KEYS.groups(),
        (currentGroups) => updater(currentGroups ?? [])
    );
};

export const resetTeamJobsGroupsQueryData = (client?: QueryClient): void => {
    setTeamJobsGroupsQueryData([], client);
};

export const createTeamJobsMutationContext = (client?: QueryClient): TeamJobsMutationContext => ({
    previousGroups: getTeamJobsGroupsQueryData(client)
});

export const restoreTeamJobsGroupsQueryData = (
    context: TeamJobsMutationContext | undefined,
    client?: QueryClient
): void => {
    if (!context) {
        return;
    }

    setTeamJobsGroupsQueryData(context.previousGroups, client);
};

const getLatestTimestamp = (jobs: Job[], fallbackTimestamp: string): string => {
    return jobs.reduce((latestTimestamp, job) => {
        if (!job.timestamp) {
            return latestTimestamp;
        }

        return job.timestamp > latestTimestamp ? job.timestamp : latestTimestamp;
    }, fallbackTimestamp);
};

const syncFrameGroup = (frameGroup: FrameJobGroup): FrameJobGroup => ({
    ...frameGroup,
    overallStatus: computeGroupStatus(frameGroup.jobs)
});

const syncTrajectoryGroup = (group: TrajectoryJobGroup): TrajectoryJobGroup | null => {
    const frameGroups = group.frameGroups
        .filter((frameGroup) => frameGroup.jobs.length > 0)
        .map(syncFrameGroup);

    if (frameGroups.length === 0) {
        return null;
    }

    const jobs = frameGroups.flatMap((frameGroup) => frameGroup.jobs);

    return {
        ...group,
        frameGroups,
        overallStatus: computeGroupStatus(jobs),
        completedCount: jobs.filter((job) => job.status === JobStatus.Completed).length,
        totalCount: jobs.length,
        latestTimestamp: getLatestTimestamp(jobs, group.latestTimestamp)
    };
};

const mapTrajectoryGroups = (
    groups: TrajectoryJobGroup[],
    trajectoryId: string,
    transformJobs: (jobs: Job[]) => Job[]
): TrajectoryJobGroup[] => {
    return groups
        .map((group) => {
            if (group.trajectoryId !== trajectoryId) {
                return group;
            }

            return {
                ...group,
                frameGroups: group.frameGroups.map((frameGroup) => ({
                    ...frameGroup,
                    jobs: transformJobs(frameGroup.jobs)
                }))
            };
        })
        .map(syncTrajectoryGroup)
        .filter((group): group is TrajectoryJobGroup => group !== null);
};

const markFailedJobsForRetryInTrajectory = (
    groups: TrajectoryJobGroup[],
    trajectoryId: string
): TrajectoryJobGroup[] => {
    return mapTrajectoryGroups(groups, trajectoryId, (jobs) =>
        jobs.map((job): Job => {
            if (job.status !== JobStatus.Failed) {
                return job;
            }

            return {
                ...job,
                status: JobStatus.QueuedAfterFailure
            };
        })
    );
};

interface OptimisticTrajectoryMutationConfig<TData, TVariables extends { trajectoryId: string }> {
    mutationFn: (variables: TVariables) => Promise<TData>;
    applyOptimisticUpdate: (groups: TrajectoryJobGroup[], trajectoryId: string) => TrajectoryJobGroup[];
    shouldRollbackOnSuccess: (result: TData) => boolean;
};

const useOptimisticTrajectoryMutation = <TData, TVariables extends { trajectoryId: string }>(
    config: OptimisticTrajectoryMutationConfig<TData, TVariables>,
    options?: MutationOptions<TData, TVariables>
) => {
    return useMutation<TData, Error, TVariables, TeamJobsMutationContext>({
        ...options,
        mutationFn: config.mutationFn,
        onMutate: async ({ trajectoryId }) => {
            const context = createTeamJobsMutationContext();

            setTeamJobsGroupsQueryData(config.applyOptimisticUpdate(context.previousGroups, trajectoryId));

            return context;
        },
        onError: (_error, _variables, context) => {
            restoreTeamJobsGroupsQueryData(context);
        },
        onSuccess: withSuccess<TData, TVariables, TeamJobsMutationContext | undefined>((result, _variables, context) => {
            if (config.shouldRollbackOnSuccess(result)) {
                restoreTeamJobsGroupsQueryData(context);
            }
        }, options)
    });
};

export const useRemoveRunningJobsMutation = (
    options?: MutationOptions<RemoveRunningJobsOutputDTO, RemoveRunningJobsParams>
) => {
    return useMutation<RemoveRunningJobsOutputDTO, Error, RemoveRunningJobsParams>({
        ...options,
        mutationFn: (params) => service.removeRunningJobs(params),
        onSuccess: withSuccess<RemoveRunningJobsOutputDTO, RemoveRunningJobsParams>((result) => {
            setTeamJobsGroupsQueryData(result.groups);
            useTeamJobsStore.getState().setLatestAppliedRevision(result.revision);
        }, options)
    });
};

export const useRetryFailedJobsMutation = (
    options?: MutationOptions<RetryFailedJobsOutputDTO, RetryFailedJobsParams>
) => {
    return useOptimisticTrajectoryMutation<RetryFailedJobsOutputDTO, RetryFailedJobsParams>({
        mutationFn: (params) => service.retryFailedJobs(params),
        applyOptimisticUpdate: markFailedJobsForRetryInTrajectory,
        shouldRollbackOnSuccess: (result) => result.retriedFrames === 0
    }, options);
};
