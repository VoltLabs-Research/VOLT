import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { computeGroupStatus } from '../utils/job-group-updates';
import { TEAM_JOBS_QUERY_KEYS } from '../utils/query-keys';
import service from '../api/service';
import { createSocketQuery, withSuccess } from '@/shared/query';
import queryClient from '@/shared/query/query-client';
import useTeamJobsStore from '../store/use-team-jobs-store';
import { useMutation } from '@tanstack/react-query';
import type {
    FrameJobGroup,
    Job,
    RemoveTeamRunningJobsResponse,
    RetryTeamFailedJobsResponse,
    TrajectoryJobGroup
} from '@volt/contracts/modules/jobs/domain';
import type { TrajectoryJobsParams } from '../api/service';
import type { MutationOptions } from '@/shared/query';

interface TeamJobsMutationContext {
    previousGroups: TrajectoryJobGroup[];
};

export const teamJobsGroups = createSocketQuery<void, TrajectoryJobGroup[]>(TEAM_JOBS_QUERY_KEYS.groups, {
    initialData: []
});

export const setTeamJobsGroupsQueryData = (groups: TrajectoryJobGroup[]): void => {
    queryClient.setQueryData<TrajectoryJobGroup[]>(TEAM_JOBS_QUERY_KEYS.groups(), groups);
};

export const updateTeamJobsGroupsQueryData = (
    updater: (groups: TrajectoryJobGroup[]) => TrajectoryJobGroup[]
): void => {
    queryClient.setQueryData<TrajectoryJobGroup[]>(
        TEAM_JOBS_QUERY_KEYS.groups(),
        (currentGroups) => updater(currentGroups ?? [])
    );
};

const createTeamJobsMutationContext = (): TeamJobsMutationContext => ({
    previousGroups: queryClient.getQueryData<TrajectoryJobGroup[]>(TEAM_JOBS_QUERY_KEYS.groups()) ?? []
});

const restoreTeamJobsGroupsQueryData = (context: TeamJobsMutationContext | undefined): void => {
    if (!context) {
        return;
    }

    setTeamJobsGroupsQueryData(context.previousGroups);
};

const getLatestTimestamp = (jobs: Job[], fallbackTimestamp: string): string => {
    return jobs.reduce((latestTimestamp, job) => {
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
    options?: MutationOptions<RemoveTeamRunningJobsResponse, TrajectoryJobsParams>
) => {
    return useMutation<RemoveTeamRunningJobsResponse, Error, TrajectoryJobsParams>({
        ...options,
        mutationFn: (params) => service.removeRunningJobs(params),
        onSuccess: withSuccess<RemoveTeamRunningJobsResponse, TrajectoryJobsParams>((result) => {
            setTeamJobsGroupsQueryData(result.groups);
            useTeamJobsStore.getState().setLatestAppliedRevision(result.revision);
        }, options)
    });
};

export const useRetryFailedJobsMutation = (
    options?: MutationOptions<RetryTeamFailedJobsResponse, TrajectoryJobsParams>
) => {
    return useOptimisticTrajectoryMutation<RetryTeamFailedJobsResponse, TrajectoryJobsParams>({
        mutationFn: (params) => service.retryFailedJobs(params),
        applyOptimisticUpdate: markFailedJobsForRetryInTrajectory,
        shouldRollbackOnSuccess: (result) => result.retriedFrames === 0
    }, options);
};
