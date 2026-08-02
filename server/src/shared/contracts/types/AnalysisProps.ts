import type {
    AnalysisArtifactStatus,
    AnalysisStageKind,
    AnalysisStageStatus
} from '@volt/contracts/modules/analysis/domain';

/*
 * The wire unions are the single source of truth. This file used to redeclare
 * `AnalysisArtifactStatus`, an identical `AnalysisExpectedArtifactStatus`, and
 * `AnalysisStageType` (the same five values as `AnalysisStageKind`), which is how
 * three definitions of one status ended up in the repo. `AnalysisStageType` is
 * kept as an alias because it is the name the server's ports already use.
 */
export type { AnalysisArtifactStatus, AnalysisStageStatus };

export type AnalysisStageType = AnalysisStageKind;

export type AnalysisConfig = Record<string, unknown>;

export interface AnalysisExpectedArtifact {
    exposureId: string;
    name: string;
    pluginId?: string;
    exporter?: string;
    exportType?: string;
    status: AnalysisArtifactStatus;
    isPrimary?: boolean;
    objectName?: string;
    readyAt?: Date;
}

export interface AnalysisStage {
    stageKey: string;
    label: string;
    type: AnalysisStageType;
    status: AnalysisStageStatus;
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
}

export interface AnalysisChildAnalysis {
    id: string;
    pluginId: string;
    pluginDisplayName?: string;
    configHash?: string;
    timestep?: number;
    status: AnalysisStageStatus;
    cacheHit?: boolean;
    startedAt?: Date;
    finishedAt?: Date;
    durationMs?: number;
}

export interface AnalysisProps {
    plugin: string;
    pluginDisplayName: string;
    computeClusterId?: string;
    storageClusterId?: string;
    config: AnalysisConfig;
    trajectory: string;
    createdBy: string;
    pipelineStageHash?: string;
    totalFrames?: number;
    startedAt?: Date;
    finishedAt?: Date;
    team: string;
    status: string;
    artifactStatus?: AnalysisArtifactStatus;
    expectedArtifacts?: AnalysisExpectedArtifact[];
    stages?: AnalysisStage[];
    childAnalyses?: AnalysisChildAnalysis[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Analysis {
    readonly _id: string;
    props: AnalysisProps;
}
