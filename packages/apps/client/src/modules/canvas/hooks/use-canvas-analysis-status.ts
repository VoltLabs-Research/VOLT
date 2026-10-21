import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { isWasmLocalTrajectoryId } from '@/modules/canvas-wasm/constants';
import { useWasmCanvasStore } from '@/modules/canvas-wasm/store';
import { buildWasmFrameActivity } from '@/modules/canvas-wasm/session';
import { useCallback, useMemo } from 'react';
import {
    buildAnalysisStatusMap,
    buildFrameStatusIndex,
    buildJobsByAnalysisId,
    findLiveLogTarget,
    pickLiveLogTarget,
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
        { enabled: enabled && !!trajectoryId && !isWasmLocalTrajectoryId(trajectoryId) }
    );

    const { data: groups = [] } = teamJobsGroups();

    const isWasm = isWasmLocalTrajectoryId(trajectoryId);
    const wasmAnalyses = useWasmCanvasStore((state) => state.analyses);
    const analyses = useMemo(() => {
        if (isWasm) {
            return wasmAnalyses;
        }
        return (analysesQuery.data as { data?: Analysis[] } | undefined)?.data ?? [];
    }, [analysesQuery.data, isWasm, wasmAnalyses]);
    const wasmActivity = useMemo(() => (isWasm ? buildWasmFrameActivity(wasmAnalyses) : null), [isWasm, wasmAnalyses]);

    const jobsByAnalysisId = useMemo(() => {
        return buildJobsByAnalysisId(groups, trajectoryId);
    }, [groups, trajectoryId]);

    const statusMap = useMemo(() => {
        return buildAnalysisStatusMap(analyses, jobsByAnalysisId, trajectoryId);
    }, [analyses, jobsByAnalysisId, trajectoryId]);

    const frameStatusIndex = useMemo(() => {
        return wasmActivity?.frameStatusIndex ?? buildFrameStatusIndex(groups, trajectoryId);
    }, [groups, trajectoryId, wasmActivity]);

    const getAnalysisStatus = useCallback((analysisId: string): CanvasAnalysisStatus | undefined => {
        return statusMap.get(analysisId)?.status;
    }, [statusMap]);

    const getAnalysisFrameStatus = useCallback((
        analysisId: string,
        timestep: number
    ): FrameJobGroupStatus | undefined => {
        return frameStatusIndex.byTimestepAndAnalysis.get(timestep)?.get(analysisId);
    }, [frameStatusIndex]);

    const getLiveLogTarget = useCallback((
        preferredAnalysisId?: string,
        preferredTimestep?: number
    ) => {
        return wasmActivity
            ? pickLiveLogTarget(wasmActivity.running, preferredAnalysisId, preferredTimestep)
            : findLiveLogTarget(groups, trajectoryId, preferredAnalysisId, preferredTimestep);
    }, [groups, trajectoryId, wasmActivity]);

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
        getLiveLogTarget,
        getFrameTone
    };
};

export default useCanvasAnalysisStatus;
