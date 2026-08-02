import type { TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';

interface PartitionedJobs {
    daemonJobs: TeamJobSummary[];
    localJobs: TeamJobSummary[];
}

/* Pure grouping, partitioning and result-shaping helpers for job maintenance. */

export const isDaemonJob = (job: TeamJobSummary): boolean => {
    return Boolean(job.teamClusterId) && job.backingSource === 'daemon';
};

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
    return [...new Set(
        [primaryClusterId, ...additionalClusterIds, ...daemonClusterIds]
            .filter((clusterId): clusterId is string => Boolean(clusterId))
    )];
};

export const distinctJobIds = (jobs: TeamJobSummary[]): string[] => {
    return [...new Set(jobs.map((job) => job.jobId))];
};

export const getErrorMessage = (error: unknown): string | undefined => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return undefined;
};
