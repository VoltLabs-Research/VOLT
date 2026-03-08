import { useMemo } from 'react';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { JobStatus } from '@/modules/jobs/api/entities/job';

const useJobStatusCounts = (trajectoryId?: string) => {
    const { data: groups = [] } = teamJobsGroups();

    return useMemo(() => {
        let queued = 0;
        let running = 0;
        let completed = 0;

        if (!trajectoryId) return { queued, running, completed };

        for (const group of groups) {
            if (group.trajectoryId !== trajectoryId) continue;
            for (const frame of group.frameGroups) {
                for (const job of frame.jobs) {
                    if (job.status === JobStatus.Queued || job.status === JobStatus.QueuedAfterFailure) queued++;
                    else if (job.status === JobStatus.Running || job.status === JobStatus.Retrying) running++;
                    else if (job.status === JobStatus.Completed) completed++;
                }
            }
        }

        return { queued, running, completed };
    }, [groups, trajectoryId]);
};

export default useJobStatusCounts;
