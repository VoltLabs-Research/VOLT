import { JobStatus } from '../api/entities/job';
import { useMemo } from 'react';
import type { Job, TrajectoryJobGroup } from '../api/entities/job';

interface UseJobsHistoryFiltersArgs {
    groups: TrajectoryJobGroup[];
    trajectoryId?: string;
    queueFilter?: string;
    isConnected: boolean;
    isLoading: boolean;
    hideAfterComplete: boolean;
};

const flattenGroups = (groups: TrajectoryJobGroup[]): Job[] => {
    return groups.flatMap((group) => group.frameGroups.flatMap((frame) => frame.jobs));
};

const useJobsHistoryFilters = ({
    groups,
    trajectoryId,
    queueFilter,
    isConnected,
    isLoading,
    hideAfterComplete
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

    const shouldShowPanel = useMemo(() => {
        if (relevantJobs.length === 0) return false;
        if (!hideAfterComplete) return true;
        return hasActiveJobs;
    }, [hasActiveJobs, hideAfterComplete, relevantJobs]);

    return {
        relevantJobs,
        hasActiveJobs,
        allJobsCompleted,
        shouldShowPanel
    };
};

export default useJobsHistoryFilters;
