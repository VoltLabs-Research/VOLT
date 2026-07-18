// Wire response types for the trajectory module — the shapes the client reads
// back from `data`. Persisted documents, populated refs and dates are strings /
// loosely typed on the wire. The heavy 3D/native payloads (dumps, GLB, colored
// / filtered / line-styled models, octree metadata, raster frames, atoms) are
// streamed as binary via `@Res()` and are NOT JSON, so only the JSON-shaped
// responses are described here (mirroring the container module's pragmatic
// `Record<string, unknown>` for opaque payloads).

/** A persisted trajectory as the client sees it (populated refs may be nested). */
export type PersistedTrajectory = Record<string, unknown>;

/** A trajectory catalog folder, as returned by `presentCatalogFolder`. */
export interface TrajectoryFolder{
    _id: string;
    title: string;
    parent: string | null;
    createdAt: string;
    updatedAt: string;
}

/** A scene-artifact record as the client sees it. */
export type SceneArtifactView = Record<string, unknown>;

/** A bundled sample simulation descriptor. */
export type SampleSimulation = Record<string, unknown>;

/** Aggregated per-team trajectory metrics (see `presentTeamMetrics`). */
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

/** Base64 preview payload (also served with an `ETag` / `Cache-Control`). */
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

// ---- Public canvas (JSON responses) -----------------------------------------

export type CanvasBootstrapResponse = unknown;
export type CanvasTrajectoryResponse = unknown;
export type CanvasSimulationCellResponse = unknown;
export type CanvasPluginResponse = unknown;
export type CanvasSubListingResponse = unknown;
export type CanvasFrameLogResponse = unknown;
export type CanvasRasterMetadataResponse = unknown;
