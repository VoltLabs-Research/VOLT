import type { BaseEntity, Ref } from '../../shared/base';
import type { User } from '../auth/domain';
import type { TeamCluster } from '../cluster/domain';

export interface AnalysisTrajectory{
    _id: string;
    name: string;
}

export type AnalysisArtifactStatus = 'pending' | 'generating' | 'uploading' | 'ready' | 'failed';

export type AnalysisStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cached';

export type AnalysisStageKind = 'system' | 'plugin-ref' | 'entrypoint' | 'exposure' | 'artifact-upload';

export interface AnalysisExpectedArtifact{
    exposureId: string;
    name: string;
    pluginId?: string;
    exporter?: string;
    exportType?: string;
    status: AnalysisArtifactStatus;
    isPrimary?: boolean;
    objectName?: string;
    readyAt?: string;
    produced?: boolean;
}

export interface AnalysisStage{
    stageKey: string;
    label: string;
    type: AnalysisStageKind;
    status: AnalysisStageStatus;
    timestep?: number;
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

export interface AnalysisChildAnalysis{
    id: string;
    pluginId: string;
    pluginDisplayName?: string;
    configHash?: string;
    timestep?: number;
    status: AnalysisStageStatus;
    cacheHit?: boolean;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
}

export interface Analysis extends BaseEntity{
    plugin: string;
    pluginDisplayName: string;
    config: Record<string, unknown>;
    trajectory: AnalysisTrajectory;
    pipelineRunId?: string;
    pipelineStageIndex?: number;
    teamCluster?: Ref<TeamCluster> | null;
    createdBy?: Ref<User>;
    totalFrames: number;
    startedAt?: string;
    finishedAt?: string;
    status: string;
    artifactStatus?: AnalysisArtifactStatus;
    expectedArtifacts?: AnalysisExpectedArtifact[];
    stages?: AnalysisStage[];
    childAnalyses?: AnalysisChildAnalysis[];
}

export interface RetryFailedFramesResponse{
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
}

export interface AnalysisFrameLogResponse{
    analysisId: string;
    timestep: number;
    status: string;
    segments: unknown[];
    nextCursor?: string;
    [key: string]: unknown;
}

export type ProvenanceRecord = Record<string, unknown>;

export interface ProvenanceQueryResponse{
    records: ProvenanceRecord[];
}

export interface ProvenanceReproduceResponse{
    command: string;
    provenanceId: string;
}
