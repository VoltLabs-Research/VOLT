import type { User } from '@/modules/auth/api/entities/user';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface AnalysisTrajectory {
    _id: string;
    name: string;
};

export type AnalysisArtifactStatus = 'pending' | 'generating' | 'uploading' | 'ready' | 'failed';
export type AnalysisStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cached';

export interface AnalysisExpectedArtifact {
    exposureId: string;
    name: string;
    pluginId?: string;
    exporter?: string;
    exportType?: string;
    status: AnalysisArtifactStatus;
    isPrimary?: boolean;
    objectName?: string;
    readyAt?: Date | string;
};

export interface AnalysisStage {
    stageKey: string;
    label: string;
    type: 'system' | 'plugin-ref' | 'entrypoint' | 'exposure' | 'artifact-upload';
    status: AnalysisStageStatus;
    timestep?: number;
    pluginId?: string;
    pluginDisplayName?: string;
    nodeId?: string;
    exposureId?: string;
    configHash?: string;
    cacheHit?: boolean;
    detail?: string;
    startedAt?: Date | string;
    finishedAt?: Date | string;
    durationMs?: number;
};

export interface AnalysisChildAnalysis {
    id: string;
    pluginId: string;
    pluginDisplayName?: string;
    configHash?: string;
    timestep?: number;
    status: AnalysisStageStatus;
    cacheHit?: boolean;
    startedAt?: Date | string;
    finishedAt?: Date | string;
    durationMs?: number;
};

export interface Analysis extends BaseEntity {
    plugin: string;
    pluginDisplayName: string;
    config: Record<string, unknown>;
    trajectory: AnalysisTrajectory;
    teamCluster?: TeamCluster | string | null;
    createdBy?: User | string;
    totalFrames: number;
    completedFrames: number;
    startedAt?: Date;
    finishedAt?: Date;
    status: string;
    artifactStatus?: AnalysisArtifactStatus;
    expectedArtifacts?: AnalysisExpectedArtifact[];
    stages?: AnalysisStage[];
    childAnalyses?: AnalysisChildAnalysis[];
};
