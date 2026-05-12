import { CanvasAnalysisStatusEnum, normalizeCanvasAnalysisStatus } from '../../utilities/analysis-status';
import {
    extractTrajectoryTimesteps,
    getSelectedTimestepsForAnalysis
} from '../../utilities/selected-timestep-analysis';

import type {
    Analysis,
    AnalysisChildAnalysis,
    AnalysisStage,
    AnalysisStageStatus
} from '@/modules/analysis/api/entities/analysis';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

export interface AnalysisExecutionOverlayRow {
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
}

const isFiniteNumber = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value);
};

const rowKey = (baseKey: string, timestep?: number): string => {
    return `${baseKey}:${isFiniteNumber(timestep) ? timestep : 'global'}`;
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
        return { ...child, status: 'completed' };
    }

    return child;
};

const isOutsideSelectedTimestepScope = (
    analysis: Analysis,
    trajectory: Trajectory | null | undefined,
    currentTimestep: number | undefined
): boolean => {
    if (!isFiniteNumber(currentTimestep)) {
        return false;
    }

    const selectedTimesteps = getSelectedTimestepsForAnalysis(
        analysis,
        extractTrajectoryTimesteps(trajectory)
    );

    return Array.isArray(selectedTimesteps) && !selectedTimesteps.includes(currentTimestep);
};

const filterRowsForCurrentTimestep = <T extends { timestep?: number }>(
    rows: T[],
    currentTimestep: number | undefined,
    hasFrameScopedRows: boolean
): T[] => {
    if (!hasFrameScopedRows) {
        return rows;
    }

    if (!isFiniteNumber(currentTimestep)) {
        return [];
    }

    return rows.filter((row) => row.timestep === currentTimestep);
};

export const buildAnalysisExecutionRows = ({
    analysis,
    trajectory,
    currentTimestep
}: BuildAnalysisExecutionRowsInput): AnalysisExecutionOverlayRow[] => {
    if (isOutsideSelectedTimestepScope(analysis, trajectory, currentTimestep)) {
        return [];
    }

    const resolvedStatus = normalizeCanvasAnalysisStatus(analysis.status);
    const allChildRows = (analysis.childAnalyses ?? [])
        .map((child) => normalizeChildForDisplay(child, resolvedStatus));
    const allStageRows = (analysis.stages ?? [])
        .map((stage) => normalizeStageForDisplay(stage, resolvedStatus))
        .filter((stage) => stage.type !== 'plugin-ref');
    const hasFrameScopedRows = [...allChildRows, ...allStageRows]
        .some((row) => isFiniteNumber(row.timestep));
    const childRows = filterRowsForCurrentTimestep(allChildRows, currentTimestep, hasFrameScopedRows);
    const stageRows = filterRowsForCurrentTimestep(allStageRows, currentTimestep, hasFrameScopedRows);

    return [
        ...childRows.map((child) => ({
            key: rowKey(child.id, child.timestep),
            label: child.pluginDisplayName ?? child.pluginId,
            status: child.status,
            cacheHit: child.cacheHit,
            durationMs: child.durationMs,
            className: 'canvas-tree-execution-row canvas-tree-execution-row--child',
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
