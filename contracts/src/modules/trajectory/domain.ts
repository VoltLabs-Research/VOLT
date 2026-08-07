import type { BaseEntity, Ref } from '../../shared/base';
import type { User } from '../auth/domain';
import type { Team } from '../team/domain';
import type { TeamCluster } from '../cluster/domain';
import type { Analysis } from '../analysis/domain';
import type { SimulationCell } from '../simulation-cell/domain';

export interface BoxBounds{
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
}

export interface TimestepInfo{
    timestep: number;
    natoms: number;
    fileId?: string;
    simulationCell?: SimulationCell;
    boxBounds?: BoxBounds;
}

export interface TrajectoryStats{
    totalFiles: number;
    totalSize: number;
}

export type TrajectoryStatus =
    | 'waiting-for-process'
    | 'queued'
    | 'processing'
    | 'completed'
    | 'failed';

export interface Trajectory extends BaseEntity{
    name: string;
    team: Ref<Team>;
    folder: string | null;
    analysis: Analysis[];
    frames: TimestepInfo[];
    framesCount?: number;
    atoms?: number;
    firstTimestep?: number;
    stats: TrajectoryStats;
    hasPreview?: boolean;
    preview?: string;
    isPublic?: boolean;
    status?: TrajectoryStatus;
    users: Ref<User>[];
    createdBy?: Ref<User>;
    storageClusterId?: Ref<TeamCluster> | null;
}

export interface TrajectoryFolder extends BaseEntity{
    title: string;
    parent: string | null;
}

export type SceneArtifactSourceType = 'color-coding' | 'particle-filter' | 'plugin-exposure' | 'line-style';

export interface SceneArtifactParticleFilterPropertyCondition{
    kind?: 'property';
    property: string;
    operator: string;
    value: number | string;
    exposureId?: string;
}

export interface SceneArtifactParams{
    property?: string;
    startValue?: number;
    endValue?: number;
    gradient?: string;
    operator?: string;
    value?: number | string;
    action?: 'delete' | 'highlight';
    exposureId?: string;
    combinator?: 'AND' | 'OR';
    conditions?: SceneArtifactParticleFilterPropertyCondition[];
    style?: Record<string, unknown>;
}

export interface SceneArtifactTrajectory{
    _id: string;
    name?: string;
    storageClusterId?: Ref<TeamCluster> | null;
}

export interface SceneArtifactAnalysis{
    _id: string;
}

export interface SceneArtifactPlugin{
    _id: string;
    name?: string;
}

export interface SceneArtifact extends BaseEntity{
    trajectory: Ref<SceneArtifactTrajectory>;
    analysis?: Ref<SceneArtifactAnalysis>;
    plugin?: Ref<SceneArtifactPlugin>;
    storageClusterId?: Ref<TeamCluster> | null;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactParams;
    displayName: string;
    status: 'ready' | 'failed';
    metadata?: Record<string, unknown>;
}

export type SampleSimulation = Record<string, unknown>;

export type TeamMetricsResponse = Record<string, unknown>;

export interface TrajectoryUploadPart{
    partNumber: number;
    offset: number;
    size: number;
    url: string;
    expiresAt: string;
}

export interface TrajectoryUploadSessionFile{
    index: number;
    originalName: string;
    size: number;
    contentType?: string;
    finalObjectKey: string;
    parts: TrajectoryUploadPart[];
}

export interface TrajectoryUploadSession{
    id: string;
    expiresAt: string;
    files: TrajectoryUploadSessionFile[];
}

export interface CreateTrajectoryUploadSessionResponse{
    trajectory: Trajectory;
    uploadSession: TrajectoryUploadSession;
}

export interface CommitTrajectoryUploadSessionResponse{
    trajectoryId: string;
}

export interface CloneTrajectoryResponse{
    trajectoryId: string;
    jobId: string;
    sourceTrajectoryId: string;
    destinationClusterId: string;
}

export type TrajectoryPreviewResponse = string;

export type ColorCodingPropertiesResponse = unknown;
export type ColorCodingStatsResponse = unknown;
export type CreateColoredModelResponse = null;

export type ParticleFilterPropertiesResponse = unknown;
export type ParticleFilterUniqueValuesResponse = unknown;
export type ParticleFilterPreviewResponse = unknown;

export interface ApplyParticleFilterActionResponse{
    fileId: string;
    atomsResult: number;
    action: string;
}

export type CreateLineStyledModelResponse = unknown;

export interface GetLineEntityPropertiesResponse{
    entityId: number;
    properties: Record<string, unknown>;
}

export type CanvasBootstrapResponse = unknown;
export type CanvasTrajectoryResponse = unknown;
export type CanvasSimulationCellResponse = unknown;
export type CanvasPluginResponse = unknown;
export type CanvasSubListingResponse = unknown;
export type CanvasFrameLogResponse = unknown;
export type CanvasRasterMetadataResponse = unknown;
