import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { useCallback, useMemo } from 'react';
import {
    buildAnalysisStatusMap,
    buildFrameStatusIndex,
    buildJobsByAnalysisId,
    toTimelineTickTone
} from '../utils/analysis-status-selectors';

import type { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { CanvasAnalysisStatus } from '../utils/analysis-status';
import type { TimelineTickTone } from '../utils/analysis-status-selectors';

interface UseCanvasAnalysisStatusProps {
    trajectoryId?: string;
    enabled?: boolean;
}

const useCanvasAnalysisStatus = ({
    trajectoryId,
    enabled = true
}: UseCanvasAnalysisStatusProps) => {
    const analysesQuery = useAnalysesByTrajectoryQuery(
        {
            trajectoryId: trajectoryId ?? '',
            page: 1,
            limit: 100
        },
        { enabled: enabled && !!trajectoryId }
    );

    const { data: groups = [] } = teamJobsGroups();

    const analyses = useMemo(() => {
        return (analysesQuery.data as { data?: Analysis[] } | undefined)?.data ?? [];
    }, [analysesQuery.data]);

    const jobsByAnalysisId = useMemo(() => {
        return buildJobsByAnalysisId(groups, trajectoryId);
    }, [groups, trajectoryId]);

    const statusMap = useMemo(() => {
        return buildAnalysisStatusMap(analyses, jobsByAnalysisId, trajectoryId);
    }, [analyses, jobsByAnalysisId, trajectoryId]);

    const frameStatusIndex = useMemo(() => {
        return buildFrameStatusIndex(groups, trajectoryId);
    }, [groups, trajectoryId]);

    const getAnalysisStatus = useCallback((analysisId: string): CanvasAnalysisStatus | undefined => {
        return statusMap.get(analysisId)?.status;
    }, [statusMap]);

    const getAnalysisFrameStatus = useCallback((
        analysisId: string,
        timestep: number
    ): FrameJobGroupStatus | undefined => {
        return frameStatusIndex.byTimestepAndAnalysis.get(timestep)?.get(analysisId);
    }, [frameStatusIndex]);

    const getFrameTone = useCallback((
        timestep: number,
        analysisId?: string
    ): TimelineTickTone | undefined => {
        const status = analysisId
            ? frameStatusIndex.byTimestepAndAnalysis.get(timestep)?.get(analysisId)
            : frameStatusIndex.aggregateByTimestep.get(timestep);

        return toTimelineTickTone(status);
    }, [frameStatusIndex]);

    return {
        statusMap,
        getAnalysisStatus,
        getAnalysisFrameStatus,
        getFrameTone
    };
};

export default useCanvasAnalysisStatus;
