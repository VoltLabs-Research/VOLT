import { AlertCircle, CheckCircle2, Circle, LoaderCircle } from 'lucide-react';
import { useMemo } from 'react';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import useCanvasAnalysisStatus from '@/modules/canvas/hooks/use-canvas-analysis-status';
import { buildAnalysisExecutionRows } from './execution-rows';

import type { Analysis, AnalysisChildAnalysis, AnalysisStage } from '@volt/contracts/modules/analysis/domain';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import { cn } from '@heroui/react';

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
    const analysesData = analysesQuery.data?.data;
    const analyses = useMemo(() => analysesData ?? [], [analysesData]);

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

    const rowToneClass = {
        running: '[&_[data-execution-label]]:text-accent',
        completed: '[&_[data-execution-label]]:text-success max-md:hidden',
        cached: '[&_[data-execution-label]]:text-success max-md:hidden',
        failed: '[&_[data-execution-label]]:text-danger'
    } as const;

    const iconToneClass = {
        running: 'text-accent',
        completed: 'text-success',
        cached: 'text-success',
        failed: 'text-danger'
    } as const;

    return (
        <div className={cn(
            'canvas-analysis-execution-overlay',
            'group pointer-events-auto absolute bottom-20 left-4 z-[4] w-[min(320px,calc(100%-2rem))] max-h-[min(42vh,360px)] overflow-auto rounded-3xl px-2.5 py-2 max-md:left-0 max-md:z-[150] max-md:w-[min(240px,calc(100%-1rem))] max-md:max-h-30 max-md:rounded-2xl max-md:px-2 max-md:py-1.5',
            isFullyCompleted && 'canvas-analysis-execution-overlay--completed max-md:hidden'
        )}>
            <div className='m-0 border-l-0 p-0' role='group' aria-label={`${analysis.pluginDisplayName} execution timeline`}>
                {rows.map((row) => (
                    <div key={row.key} className={cn(
                        'flex min-h-[22px] items-center gap-1.5 text-[0.72rem] text-muted max-md:min-h-[18px] max-md:gap-1 max-md:text-[0.625rem]',
                        row.status in rowToneClass && rowToneClass[row.status as keyof typeof rowToneClass]
                    )}>
                        <span className={cn(
                            'inline-flex size-3.5 items-center justify-center text-muted',
                            row.status in iconToneClass && iconToneClass[row.status as keyof typeof iconToneClass]
                        )}>
                            {getStageIcon(row.iconSource)}
                        </span>
                        <span data-execution-label className='min-w-0 flex-auto truncate'>{row.label}</span>
                        {row.cacheHit && <span className='invisible flex-none text-[0.65rem] leading-none text-muted opacity-0 transition-[opacity,visibility] duration-[120ms] ease-out group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 max-md:hidden px-1 py-0.5'>cached</span>}
                        {row.durationMs !== undefined && (
                            <span className='invisible flex-none text-[0.65rem] leading-none text-muted opacity-0 transition-[opacity,visibility] duration-[120ms] ease-out group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 max-md:hidden'>{formatDuration(row.durationMs)}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AnalysisExecutionOverlay;
