import { AlertCircle, CheckCircle2, Circle, LoaderCircle } from 'lucide-react';
import { useMemo } from 'react';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import useCanvasAnalysisStatus from '@/modules/canvas/hooks/use-canvas-analysis-status';
import { buildAnalysisExecutionRows } from './execution-rows';

import type { Analysis, AnalysisChildAnalysis, AnalysisStage } from '@volt/contracts/modules/analysis/domain';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import { cn } from '@heroui/react';
import {
    EXECUTION_BLOCK_CLASS,
    EXECUTION_CHIP_CLASS,
    EXECUTION_ICON_CLASS,
    EXECUTION_ICON_TONE_CLASS,
    EXECUTION_LABEL_CLASS,
    EXECUTION_META_CLASS,
    OVERLAY_CLASS,
    OVERLAY_COMPLETED_CLASS
} from './execution-classes';

interface AnalysisExecutionOverlayProps {
    trajectory?: Trajectory | null;
    analysisId?: string;
    currentTimestep?: number;
}

const formatDuration = (durationMs?: number): string => {
    if (durationMs === undefined) return '';
    if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
    if (durationMs < 10000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${Math.round(durationMs / 1000)}s`;
};

const getStageIcon = (stage: Pick<AnalysisStage | AnalysisChildAnalysis, 'status' | 'cacheHit'>) => {
    if (stage.status === 'failed') return <AlertCircle style={{
        width: 11,
        height: 11
    }} />;
    if (stage.status === 'completed' || stage.status === 'cached') return <CheckCircle2 style={{
        width: 11,
        height: 11
    }} />;
    if (stage.status === 'running') return <LoaderCircle style={{
        width: 11,
        height: 11
    }} />;
    return <Circle style={{
        width: 11,
        height: 11
    }} />;
};

const resolveSelectedAnalysis = (
    analysisId: string | undefined,
    trajectoryId: string | undefined,
    analyses: Analysis[],
    trajectoryAnalyses: Analysis[] | undefined
): Analysis | undefined => {
    if (!analysisId) {
        return undefined;
    }

    return analyses.find((analysis) => analysis._id === analysisId)
        ?? findCachedAnalysisById({
            analysisId,
            trajectoryId
        })
        ?? trajectoryAnalyses?.find((analysis) => analysis._id === analysisId);
};

const AnalysisExecutionOverlay = ({ trajectory, analysisId, currentTimestep }: AnalysisExecutionOverlayProps) => {
    const trajectoryId = trajectory?._id;
    const { getAnalysisStatus } = useCanvasAnalysisStatus({ trajectoryId, enabled: !!trajectoryId });
    const analysesQuery = useAnalysesByTrajectoryQuery(
        {
            trajectoryId: trajectoryId ?? '',
            page: 1,
            limit: 100
        },
        { enabled: Boolean(trajectoryId && analysisId) }
    );
    const analyses = analysesQuery.data?.data ?? [];

    const analysis = useMemo(() => {
        return resolveSelectedAnalysis(
            analysisId,
            trajectoryId,
            analyses,
            trajectory?.analysis
        );
    }, [analyses, analysisId, trajectory?.analysis, trajectoryId]);

    const rows = useMemo(() => {
        if (!analysis) {
            return [];
        }

        return buildAnalysisExecutionRows({
            analysis,
            trajectory,
            currentTimestep,
            resolvedStatus: getAnalysisStatus(analysis._id)
        });
    }, [analysis, currentTimestep, trajectory, getAnalysisStatus]);

    if (!analysis || rows.length === 0) {
        return null;
    }

    const isFullyCompleted = rows.every((row) => row.status === 'completed' || row.status === 'cached');

    return (
        <div className={cn(
            'canvas-analysis-execution-overlay',
            OVERLAY_CLASS,
            isFullyCompleted && `canvas-analysis-execution-overlay--completed ${OVERLAY_COMPLETED_CLASS}`
        )}>
            <div className={EXECUTION_BLOCK_CLASS} role='group' aria-label={`${analysis.pluginDisplayName} execution timeline`}>
                {rows.map((row) => (
                    <div key={row.key} className={row.className}>
                        <span className={cn(
                            EXECUTION_ICON_CLASS,
                            row.status in EXECUTION_ICON_TONE_CLASS && EXECUTION_ICON_TONE_CLASS[row.status as keyof typeof EXECUTION_ICON_TONE_CLASS]
                        )}>
                            {getStageIcon(row.iconSource)}
                        </span>
                        {/*
                          * `data-execution-label` replaces the `.canvas-tree-execution-label`
                          * class the row's tone rule selected: the tone lives on the row, and a
                          * descendant variant needs something to aim at.
                          */}
                        <span data-execution-label className={EXECUTION_LABEL_CLASS}>{row.label}</span>
                        {row.cacheHit && <span className={`${EXECUTION_META_CLASS} ${EXECUTION_CHIP_CLASS}`}>cached</span>}
                        {row.durationMs !== undefined && (
                            <span className={EXECUTION_META_CLASS}>{formatDuration(row.durationMs)}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AnalysisExecutionOverlay;
