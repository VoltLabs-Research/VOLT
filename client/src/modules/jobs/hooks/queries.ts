import { useMutation, type QueryClient } from '@tanstack/react-query';
import {
    buildKeys,
    createSocketQuery,
    type MutationOptions
} from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
import service from '../api/service';
import { JobStatus, type FrameJobGroup, type Job, type TrajectoryJobGroup } from '../api/entities/job';
import type { ClearHistoryOutputDTO } from '../api/dtos/clear-history';
import type { RemoveRunningJobsOutputDTO } from '../api/dtos/remove-running-jobs';
import type { RetryFailedJobsOutputDTO } from '../api/dtos/retry-failed-jobs';
import { computeGroupStatus } from '../utilities/job-group-updates';

export const TEAM_JOBS_QUERY_KEYS = buildKeys<{
    groups: void;
}>('team-jobs');

export interface TeamJobsMutationContext {
    previousGroups: TrajectoryJobGroup[];
}

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

const compactTrajectoryGroups = (groups: TrajectoryJobGroup[]): TrajectoryJobGroup[] => {
    return groups
        .map(syncTrajectoryGroup)
        .filter((group): group is TrajectoryJobGroup => group !== null);
};

const removeRunningJobsFromGroups = (groups: TrajectoryJobGroup[]): TrajectoryJobGroup[] => {
    return compactTrajectoryGroups(groups.map((group) => ({
        ...group,
        frameGroups: group.frameGroups.map((frameGroup) => ({
            ...frameGroup,
            jobs: frameGroup.jobs.filter((job) => job.status !== JobStatus.Running)
        }))
    })));
};

const markFailedJobsForRetry = (groups: TrajectoryJobGroup[]): TrajectoryJobGroup[] => {
    return compactTrajectoryGroups(groups.map((group) => ({
        ...group,
        frameGroups: group.frameGroups.map((frameGroup) => ({
            ...frameGroup,
            jobs: frameGroup.jobs.map((job): Job => job.status === JobStatus.Failed
                ? { ...job, status: JobStatus.QueuedAfterFailure }
                : job)
        }))
    })));
};

export const useRemoveRunningJobsMutation = (options?: MutationOptions<RemoveRunningJobsOutputDTO, void>) => {
    return useMutation<RemoveRunningJobsOutputDTO, Error, void, TeamJobsMutationContext>({
        ...options,
        mutationFn: () => service.removeRunningJobs({}),
        onMutate: async () => {
            const context = createTeamJobsMutationContext();

            setTeamJobsGroupsQueryData(removeRunningJobsFromGroups(context.previousGroups));

            return context;
        },
        onError: (_error, _variables, context) => {
            restoreTeamJobsGroupsQueryData(context);
        },
        onSuccess: (result, _variables, context) => {
            if (result.deletedJobs === 0 && result.deletedAnalyses === 0) {
                restoreTeamJobsGroupsQueryData(context);
            }
        },
        onSettled: options?.onSettled
    });
};

export const useRetryFailedJobsMutation = (options?: MutationOptions<RetryFailedJobsOutputDTO, void>) => {
    return useMutation<RetryFailedJobsOutputDTO, Error, void, TeamJobsMutationContext>({
        ...options,
        mutationFn: () => service.retryFailedJobs({}),
        onMutate: async () => {
            const context = createTeamJobsMutationContext();

            setTeamJobsGroupsQueryData(markFailedJobsForRetry(context.previousGroups));

            return context;
        },
        onError: (_error, _variables, context) => {
            restoreTeamJobsGroupsQueryData(context);
        },
        onSuccess: (result, _variables, context) => {
            if (result.retriedFrames === 0) {
                restoreTeamJobsGroupsQueryData(context);
            }
        },
        onSettled: options?.onSettled
    });
};

export const useClearJobHistoryMutation = (options?: MutationOptions<ClearHistoryOutputDTO, void>) => {
    return useMutation<ClearHistoryOutputDTO, Error, void, TeamJobsMutationContext>({
        ...options,
        mutationFn: () => service.clearHistory({}),
        onMutate: async () => {
            const context = createTeamJobsMutationContext();

            setTeamJobsGroupsQueryData([]);

            return context;
        },
        onError: (_error, _variables, context) => {
            restoreTeamJobsGroupsQueryData(context);
        },
        onSuccess: (result, _variables, context) => {
            if (result.deletedJobs === 0 && result.deletedAnalyses === 0) {
                restoreTeamJobsGroupsQueryData(context);
            }
        },
        onSettled: options?.onSettled
    });
};
