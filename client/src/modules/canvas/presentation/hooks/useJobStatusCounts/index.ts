import { useMemo } from 'react';
import useTeamJobsStore from '@/modules/jobs/presentation/stores/use-team-jobs-store';

const useJobStatusCounts = (trajectoryId?: string) => {
    const groups = useTeamJobsStore((s) => s.groups);

    return useMemo(() => {
        let queued = 0;
        let running = 0;
        let completed = 0;

        if (!trajectoryId) return { queued, running, completed };

        for (const group of groups) {
            if (group.trajectoryId !== trajectoryId) continue;
            for (const frame of group.frameGroups) {
                for (const job of frame.jobs) {
                    if (job.status === 'queued' || job.status === 'queued_after_failure') queued++;
                    else if (job.status === 'running' || job.status === 'retrying') running++;
                    else if (job.status === 'completed') completed++;
                }
            }
        }

        return { queued, running, completed };
    }, [groups, trajectoryId]);
};

export default useJobStatusCounts;
