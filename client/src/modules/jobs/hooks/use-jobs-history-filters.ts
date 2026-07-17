import { JobStatus } from '../api/types/job';
import { useMemo } from 'react';
import type { Job, TrajectoryJobGroup } from '../api/types/job';

interface UseJobsHistoryFiltersArgs {
    groups: TrajectoryJobGroup[];
    trajectoryId?: string;
    queueFilter?: string;
    isConnected: boolean;
    isLoading: boolean;
};

const flattenGroups = (groups: TrajectoryJobGroup[]): Job[] => {
    return groups.flatMap((group) => group.frameGroups.flatMap((frame) => frame.jobs));
};

const useJobsHistoryFilters = ({
    groups,
    trajectoryId,
    queueFilter,
    isConnected,
    isLoading
}: UseJobsHistoryFiltersArgs) => {
    const relevantJobs = useMemo(() => {
        let allJobs = flattenGroups(groups);
        if (trajectoryId) {
            allJobs = allJobs.filter((job) => job.trajectoryId === trajectoryId);
        }
        if (queueFilter) {
            allJobs = allJobs.filter((job) => job.queueType?.includes(queueFilter));
        }
        return allJobs;
    }, [groups, trajectoryId, queueFilter]);

    const hasActiveJobs = useMemo(() => {
        if (!isConnected || isLoading) return false;
        if (relevantJobs.length === 0) return false;
        return relevantJobs.some((job) => job.status !== JobStatus.Completed && job.status !== JobStatus.Failed);
    }, [relevantJobs, isConnected, isLoading]);

    const allJobsCompleted = useMemo(() => {
        if (relevantJobs.length === 0) return false;
        return relevantJobs.every((job) => job.status === JobStatus.Completed);
    }, [relevantJobs]);

    return {
        relevantJobs,
        hasActiveJobs,
        allJobsCompleted
    };
};

export default useJobsHistoryFilters;
