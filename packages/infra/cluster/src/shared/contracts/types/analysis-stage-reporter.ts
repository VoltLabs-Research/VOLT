import type { AnalysisStageKind, AnalysisStageStatus } from '@volt/contracts/modules/analysis/domain';

export interface AnalysisStageReportInput {
    stageKey: string;
    label: string;
    stageType: AnalysisStageKind;
    stageStatus: AnalysisStageStatus;
    timestep?: number;
    pluginId?: string;
    pluginDisplayName?: string;
    nodeId?: string;
    exposureId?: string;
    configHash?: string;
    cacheHit?: boolean;
    detail?: string;
    startedAt?: Date;
    finishedAt?: Date;
    durationMs?: number;
    producedArtifacts?: boolean;
}

export interface AnalysisStageReporter {
    report(input: AnalysisStageReportInput): Promise<void>;
}
