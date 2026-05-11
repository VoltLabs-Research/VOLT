export type AnalysisConfig = Record<string, unknown>;

export type AnalysisArtifactStatus = 'pending' | 'generating' | 'uploading' | 'ready' | 'failed';

export type AnalysisExpectedArtifactStatus = 'pending' | 'generating' | 'uploading' | 'ready' | 'failed';

export interface AnalysisExpectedArtifact {
    exposureId: string;
    name: string;
    pluginId?: string;
    exporter?: string;
    exportType?: string;
    status: AnalysisExpectedArtifactStatus;
    isPrimary?: boolean;
    objectName?: string;
    readyAt?: Date;
}

export type AnalysisStageType = 'system' | 'plugin-ref' | 'entrypoint' | 'exposure' | 'artifact-upload';
export type AnalysisStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cached';

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
    totalFrames?: number;
    completedFrames?: number;
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

export const createAnalysis = (_id: string, props: AnalysisProps): Analysis => ({
    _id,
    props
});

export default Analysis;
