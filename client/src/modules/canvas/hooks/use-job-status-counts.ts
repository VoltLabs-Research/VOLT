import { JobStatus } from '@/modules/jobs/api/entities/job';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { useMemo } from 'react';

interface JobStatusCounts {
    queued: number;
    running: number;
    completed: number;
}

const INITIAL_COUNTS: JobStatusCounts = {
    queued: 0,
    running: 0,
    completed: 0
};

const isQueuedJobStatus = (status: JobStatus): boolean => {
    return status === JobStatus.Queued || status === JobStatus.QueuedAfterFailure;
};

const isRunningJobStatus = (status: JobStatus): boolean => {
    return status === JobStatus.Running || status === JobStatus.Retrying;
};

const useJobStatusCounts = (trajectoryId?: string) => {
    const { data: groups = [] } = teamJobsGroups();

    return useMemo(() => {
        const counts = { ...INITIAL_COUNTS };

        for (const group of groups) {
            if (trajectoryId && group.trajectoryId !== trajectoryId) {
                continue;
            }

            for (const frame of group.frameGroups) {
                for (const job of frame.jobs) {
                    if (isQueuedJobStatus(job.status)) {
                        counts.queued += 1;
                        continue;
                    }

                    if (isRunningJobStatus(job.status)) {
                        counts.running += 1;
                        continue;
                    }

                    if (job.status === JobStatus.Completed) {
                        counts.completed += 1;
                    }
                }
            }
        }

        return counts;
    }, [groups, trajectoryId]);
};

export default useJobStatusCounts;
