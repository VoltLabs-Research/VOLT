import type {
    AnalysisStageStatus,
    AnalysisStageType
} from '@shared/contracts/channel/reverse-channel-analysis';

export interface AnalysisStageReportInput {
    stageKey: string;
    label: string;
    stageType: AnalysisStageType;
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
