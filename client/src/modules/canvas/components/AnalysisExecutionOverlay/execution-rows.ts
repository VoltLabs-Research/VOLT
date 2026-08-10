import { CanvasAnalysisStatusEnum, normalizeCanvasAnalysisStatus } from '../../utils/analysis-status';
import {
    extractTrajectoryTimesteps,
    getSelectedTimestepsForAnalysis
} from '../../utils/selected-timestep-analysis';

import type { CanvasAnalysisStatus } from '../../utils/analysis-status';
import type {
    Analysis,
    AnalysisChildAnalysis,
    AnalysisStage,
    AnalysisStageStatus
} from '@volt/contracts/modules/analysis/domain';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface AnalysisExecutionOverlayRow {
    key: string;
    label: string;
    status: AnalysisStageStatus;
    cacheHit?: boolean;
    durationMs?: number;
    className: string;
    iconSource: AnalysisStage | AnalysisChildAnalysis;
}

interface BuildAnalysisExecutionRowsInput {
    analysis: Analysis;
    trajectory?: Trajectory | null;
    currentTimestep?: number;
    /*
     * The merged status, from the caller that holds the hook. The row alone lags the
     * jobs, so child and stage rows were labelled against a status the timeline had
     * already moved past.
     */
    resolvedStatus?: CanvasAnalysisStatus;
}

const rowKey = (baseKey: string, timestep?: number): string => {
    return `${baseKey}:${timestep ?? 'global'}`;
};

const normalizeStageForDisplay = (
    stage: AnalysisStage,
    analysisStatus: ReturnType<typeof normalizeCanvasAnalysisStatus>
): AnalysisStage => {
    if (analysisStatus !== CanvasAnalysisStatusEnum.Completed
        || stage.status !== 'running'
        || stage.type === 'artifact-upload') {
        return stage;
    }

    return {
        ...stage,
        status: 'completed'
    };
};

const normalizeChildForDisplay = (
    child: AnalysisChildAnalysis,
    analysisStatus: ReturnType<typeof normalizeCanvasAnalysisStatus>
): AnalysisChildAnalysis => {
    if (analysisStatus === CanvasAnalysisStatusEnum.Completed && child.status === 'running') {
        return {
            ...child,
            status: 'completed'
        };
    }

    return child;
};

const isOutsideSelectedTimestepScope = (
    analysis: Analysis,
    trajectory: Trajectory | null | undefined,
    currentTimestep: number | undefined
): boolean => {
    if (currentTimestep === undefined) {
        return false;
    }

    const selectedTimesteps = getSelectedTimestepsForAnalysis(
        analysis,
        extractTrajectoryTimesteps(trajectory)
    );

    return !!selectedTimesteps && !selectedTimesteps.includes(currentTimestep);
};

const filterRowsForCurrentTimestep = <T extends { timestep?: number }>(
    rows: T[],
    currentTimestep: number | undefined,
    hasFrameScopedRows: boolean
): T[] => {
    if (!hasFrameScopedRows) {
        return rows;
    }

    if (currentTimestep === undefined) {
        return [];
    }

    return rows.filter((row) => row.timestep === currentTimestep);
};

export const buildAnalysisExecutionRows = ({
    analysis,
    trajectory,
    currentTimestep,
    resolvedStatus: mergedStatus
}: BuildAnalysisExecutionRowsInput): AnalysisExecutionOverlayRow[] => {
    if (isOutsideSelectedTimestepScope(analysis, trajectory, currentTimestep)) {
        return [];
    }

    const resolvedStatus = mergedStatus ?? normalizeCanvasAnalysisStatus(analysis.status);
    const allChildRows = (analysis.childAnalyses ?? [])
        .map((child) => normalizeChildForDisplay(child, resolvedStatus));
    const allStageRows = (analysis.stages ?? [])
        .map((stage) => normalizeStageForDisplay(stage, resolvedStatus))
        .filter((stage) => stage.type !== 'plugin-ref');
    const hasFrameScopedRows = [...allChildRows, ...allStageRows]
        .some((row) => row.timestep !== undefined);
    const childRows = filterRowsForCurrentTimestep(allChildRows, currentTimestep, hasFrameScopedRows);
    const stageRows = filterRowsForCurrentTimestep(allStageRows, currentTimestep, hasFrameScopedRows);

    return [
        ...childRows.map((child) => ({
            key: rowKey(child.id, child.timestep),
            label: child.pluginDisplayName ?? child.pluginId,
            status: child.status,
            cacheHit: child.cacheHit,
            durationMs: child.durationMs,
            className: `canvas-tree-execution-row canvas-tree-execution-row--child canvas-tree-execution-row--${child.status}`,
            iconSource: child
        })),
        ...stageRows.map((stage) => ({
            key: rowKey(stage.stageKey, stage.timestep),
            label: stage.label,
            status: stage.status,
            cacheHit: stage.cacheHit,
            durationMs: stage.durationMs,
            className: `canvas-tree-execution-row canvas-tree-execution-row--${stage.status}`,
            iconSource: stage
        }))
    ];
};
