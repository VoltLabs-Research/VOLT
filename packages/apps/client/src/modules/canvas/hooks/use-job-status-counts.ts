import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { buildJobStatusCounts } from '@/modules/canvas/utils/analysis-status-selectors';
import { useMemo } from 'react';

import type { JobStatusCounts } from '@/modules/canvas/utils/analysis-status-selectors';

const useJobStatusCounts = (trajectoryId?: string): JobStatusCounts => {
    const { data: groups = [] } = teamJobsGroups();

    return useMemo(() => {
        return buildJobStatusCounts(groups, trajectoryId);
    }, [groups, trajectoryId]);
};

export default useJobStatusCounts;
