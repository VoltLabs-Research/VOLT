import { AlertCircle, CheckCircle2, Circle, LoaderCircle } from 'lucide-react';
import { useMemo } from 'react';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { buildAnalysisExecutionRows } from './execution-rows';

import type { Analysis, AnalysisChildAnalysis, AnalysisStage } from '@/modules/analysis/api/entities/analysis';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

import './AnalysisExecutionOverlay.css';

interface AnalysisExecutionOverlayProps {
    trajectory?: Trajectory | null;
    analysisId?: string;
    currentTimestep?: number;
}

const formatDuration = (durationMs?: number): string => {
    if (typeof durationMs !== 'number') return '';
    if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
    if (durationMs < 10000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${Math.round(durationMs / 1000)}s`;
};

const getStageIcon = (stage: Pick<AnalysisStage | AnalysisChildAnalysis, 'status' | 'cacheHit'>) => {
    if (stage.status === 'failed') return <AlertCircle style={{ width: 11, height: 11 }} />;
    if (stage.status === 'completed' || stage.status === 'cached') return <CheckCircle2 style={{ width: 11, height: 11 }} />;
    if (stage.status === 'running') return <LoaderCircle style={{ width: 11, height: 11 }} />;
    return <Circle style={{ width: 11, height: 11 }} />;
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
        ?? findCachedAnalysisById({ analysisId, trajectoryId })
        ?? trajectoryAnalyses?.find((analysis) => analysis._id === analysisId);
};

const AnalysisExecutionOverlay = ({ trajectory, analysisId, currentTimestep }: AnalysisExecutionOverlayProps) => {
    const trajectoryId = trajectory?._id;
    const analysesQuery = useAnalysesByTrajectoryQuery(
        { trajectoryId: trajectoryId ?? '', page: 1, limit: 100 },
        { enabled: Boolean(trajectoryId && analysisId) }
    );
    const analyses = analysesQuery.data?.data ?? [];

    const analysis = useMemo(() => {
        return resolveSelectedAnalysis(
            analysisId,
            trajectoryId,
            analyses,
            trajectory?.analysis as Analysis[] | undefined
        );
    }, [analyses, analysisId, trajectory?.analysis, trajectoryId]);

    const rows = useMemo(() => {
        if (!analysis) {
            return [];
        }

        return buildAnalysisExecutionRows({ analysis, trajectory, currentTimestep });
    }, [analysis, currentTimestep, trajectory]);

    if (!analysis || rows.length === 0) {
        return null;
    }

    const isFullyCompleted = rows.every((row) => row.status === 'completed' || row.status === 'cached');
    const overlayClassName = [
        'canvas-analysis-execution-overlay',
        isFullyCompleted ? 'canvas-analysis-execution-overlay--completed' : ''
    ].filter(Boolean).join(' ');

    return (
        <div className={overlayClassName}>
            <div className="canvas-tree-execution-block" role="group" aria-label={`${analysis.pluginDisplayName} execution timeline`}>
                {rows.map((row) => (
                    <div key={row.key} className={row.className}>
                        <span className={`canvas-tree-execution-icon canvas-tree-execution-icon--${row.status}`}>
                            {getStageIcon(row.iconSource)}
                        </span>
                        <span className="canvas-tree-execution-label truncate">{row.label}</span>
                        {row.cacheHit && <span className="canvas-tree-execution-chip">cached</span>}
                        {typeof row.durationMs === 'number' && (
                            <span className="canvas-tree-execution-duration">{formatDuration(row.durationMs)}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AnalysisExecutionOverlay;
