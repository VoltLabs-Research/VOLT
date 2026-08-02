import type { TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';
import type {
    RemoveTeamJobsResult,
    RetryTeamJobsResult
} from '@shared/contracts/ports/ITeamJobMaintenanceService';

interface PartitionedJobs {
    daemonJobs: TeamJobSummary[];
    localJobs: TeamJobSummary[];
}

/* Pure grouping, partitioning and result-shaping helpers for job maintenance. */

export const partitionByBackingSource = (jobs: TeamJobSummary[]): PartitionedJobs => {
    const daemonJobs: TeamJobSummary[] = [];
    const localJobs: TeamJobSummary[] = [];

    for (const job of jobs) {
        if (isDaemonJob(job)) {
            daemonJobs.push(job);
            continue;
        }

        localJobs.push(job);
    }

    return {
        daemonJobs,
        localJobs
    };
};

export const groupByCluster = (jobs: TeamJobSummary[]): Map<string, TeamJobSummary[]> => {
    const grouped = new Map<string, TeamJobSummary[]>();

    for (const job of jobs) {
        if (!job.teamClusterId) {
            throw new Error(`[TeamJobMaintenanceService] Missing teamClusterId for daemon job ${job.jobId}`);
        }

        const bucket = grouped.get(job.teamClusterId) ?? [];
        bucket.push(job);
        grouped.set(job.teamClusterId, bucket);
    }

    return grouped;
};

export const collectCleanupClusterIds = (
        primaryClusterId: string | undefined,
        additionalClusterIds: string[],
        daemonClusterIds: string[]
    ): string[] => {
    return [
        primaryClusterId,
        ...additionalClusterIds,
        ...daemonClusterIds
    ].filter((clusterId): clusterId is string => Boolean(clusterId))
        .filter((clusterId, index, values) => values.indexOf(clusterId) === index);
};

export const distinctJobIds = (jobs: TeamJobSummary[]): string[] => {
    return [...new Set(jobs.map((job) => job.jobId).filter((jobId) => jobId.trim().length > 0))];
};

const isDaemonJob = (job: TeamJobSummary): boolean => {
    return Boolean(job.teamClusterId) && job.backingSource === 'daemon';
};

export const getErrorMessage = (error: unknown): string | undefined => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return undefined;
};

export const didRedisMutationAffect = (result: [Error | null, unknown] | undefined): boolean => {
    if (!result) {
        return false;
    }

    const [error, value] = result;
    if (error) {
        return false;
    }

    return typeof value === 'number' && value > 0;
};

export const emptyRemoveResult = (): RemoveTeamJobsResult => {
    return {
        deletedJobs: 0,
        deletedAnalyses: 0,
        affectedClusters: 0,
        clusterFailures: []
    };
};

export const emptyRetryResult = (): RetryTeamJobsResult => {
    return {
        retriedFrames: 0,
        affectedClusters: 0,
        clusterFailures: []
    };
};
