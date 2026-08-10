import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { buildJobStatusCounts } from '@/modules/canvas/utils/analysis-status-selectors';
import { useMemo } from 'react';

import type { JobStatusCounts } from '@/modules/canvas/utils/analysis-status-selectors';

/**
 * Job counts for one trajectory, or team-wide when no id is given.
 *
 * Kept separate from `useCanvasAnalysisStatus` on purpose: the dashboard's bottom bar
 * counts jobs with no canvas open, and pulling it through that hook would make it
 * fetch a trajectory's analyses it has no use for. The bucketing itself is shared —
 * `buildJobStatusCounts` is the same derivation the canvas uses, so the drawer and the
 * timeline can no longer disagree about what "queued" means.
 */
const useJobStatusCounts = (trajectoryId?: string): JobStatusCounts => {
    const { data: groups = [] } = teamJobsGroups();

    return useMemo(() => {
        return buildJobStatusCounts(groups, trajectoryId);
    }, [groups, trajectoryId]);
};

export default useJobStatusCounts;
