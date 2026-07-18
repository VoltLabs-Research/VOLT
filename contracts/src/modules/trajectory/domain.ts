

export type PersistedTrajectory = Record<string, unknown>;

export interface TrajectoryFolder{
    _id: string;
    title: string;
    parent: string | null;
    createdAt: string;
    updatedAt: string;
}

export type SceneArtifactView = Record<string, unknown>;

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

export interface CreateTrajectoryUploadSessionResponse{
    trajectory: PersistedTrajectory;
    uploadSession: {
        id: string;
        chunkSize: number;
        expiresAt: string;
        files: TrajectoryUploadSessionFile[];
    };
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
