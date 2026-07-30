import type {
    AnalysisStageStatus,
    AnalysisStageType
} from '@shared/contracts/types';

export interface DaemonJobInputBase {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    error?: string;
}

export interface DaemonAnalysisStageStatusInput extends DaemonJobInputBase {
    name: string;
    analysisId: string;
    trajectoryId?: string;
    timestep?: number;
    stageKey: string;
    label: string;
    stageType: AnalysisStageType;
    stageStatus: AnalysisStageStatus;
    pluginId?: string;
    pluginDisplayName?: string;
    nodeId?: string;
    exposureId?: string;
    configHash?: string;
    cacheHit?: boolean;
    detail?: string;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
}
