import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { useCallback, useMemo } from 'react';
import {
    buildActivitySummary,
    buildAnalysisStatusMap,
    buildFrameStatusIndex,
    buildJobStatusCounts,
    buildJobsByAnalysisId,
    toTimelineTickTone
} from '../utils/analysis-status-selectors';
import { isCanvasAnalysisInProgress } from '../utils/analysis-status';

import type { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { CanvasAnalysisStatus } from '../utils/analysis-status';
import type { TimelineTickTone } from '../utils/analysis-status-selectors';

interface UseCanvasAnalysisStatusProps {
    trajectoryId?: string;
    enabled?: boolean;
    /**
     * Analyses to fall back on before the query resolves — typically the ones already
     * embedded in a `Trajectory`. Taken here rather than at a call site so their status
     * still goes through the one merge, instead of a caller inventing a second rule for
     * the first render.
     */
    fallbackAnalyses?: readonly Analysis[];
}

/**
 * The canvas' single reader of analysis and job state.
 *
 * Four hooks used to fetch these same two queries and derive their own answer from
 * them, with four different precedence rules — see `analysis-status-selectors` for
 * what each of them got wrong. Everything the canvas asks about analysis progress now
 * resolves through here, so two views cannot disagree.
 *
 * Each selector is memoised on its own rather than bundled into one object: a consumer
 * that only reads `counts` should not re-render because a tone changed.
 */
const useCanvasAnalysisStatus = ({
    trajectoryId,
    enabled = true,
    fallbackAnalyses
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
        const fetched = (analysesQuery.data as { data?: Analysis[] } | undefined)?.data;
        if (fetched?.length) return fetched;

        return fallbackAnalyses ?? fetched ?? [];
    }, [analysesQuery.data, fallbackAnalyses]);

    const jobsByAnalysisId = useMemo(() => {
        return buildJobsByAnalysisId(groups, trajectoryId);
    }, [groups, trajectoryId]);

    const statusMap = useMemo(() => {
        return buildAnalysisStatusMap(analyses, jobsByAnalysisId, trajectoryId);
    }, [analyses, jobsByAnalysisId, trajectoryId]);

    const frameStatusIndex = useMemo(() => {
        return buildFrameStatusIndex(groups, trajectoryId);
    }, [groups, trajectoryId]);

    const counts = useMemo(() => {
        return buildJobStatusCounts(groups, trajectoryId);
    }, [groups, trajectoryId]);

    const activitySummary = useMemo(() => {
        return buildActivitySummary(analyses, statusMap);
    }, [analyses, statusMap]);

    const getAnalysisStatus = useCallback((analysisId: string): CanvasAnalysisStatus | undefined => {
        return statusMap.get(analysisId)?.status;
    }, [statusMap]);

    const isAnalysisInProgress = useCallback((analysisId: string): boolean => {
        return isCanvasAnalysisInProgress(statusMap.get(analysisId)?.status);
    }, [statusMap]);

    /** One analysis on one frame — what the ruler colours when an analysis is selected. */
    const getAnalysisFrameStatus = useCallback((
        analysisId: string,
        timestep: number
    ): FrameJobGroupStatus | undefined => {
        return frameStatusIndex.byTimestepAndAnalysis.get(timestep)?.get(analysisId);
    }, [frameStatusIndex]);

    /**
     * Tick tone for a frame, scoped to an analysis when one is selected.
     *
     * Without the scope this reduced every analysis on the frame to one colour, so a
     * queued PTM run painted the tick orange while the DXA row next to it read as
     * running. That mismatch is the whole reason this hook exists.
     */
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
        analyses,
        statusMap,
        counts,
        activitySummary,
        getAnalysisStatus,
        isAnalysisInProgress,
        getAnalysisFrameStatus,
        getFrameTone
    };
};

export default useCanvasAnalysisStatus;
