import type { TrajectoryProps } from '@shared/contracts/types/Trajectory';
import type { SceneArtifactProps, SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import type { GlbContentEncoding } from '@shared/application/utilities/glb-stream-resolution';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { ParticleFilterCombinator } from '@volt/contracts/modules/trajectory/http';
import type { Readable } from 'node:stream';
import type { ReadStream } from 'node:fs';
import type {
    CloneTrajectoryInput as WireCloneTrajectoryInput,
    CreateColoredModelInput as WireCreateColoredModelInput,
    CreateTrajectoryUploadSessionInput as WireCreateTrajectoryUploadSessionInput,
    MoveTrajectoryInput as WireMoveTrajectoryInput,
    TrajectoryUploadFileInput
} from '@volt/contracts/modules/trajectory/http';

/**
 * Wire projection of a trajectory row. Every trajectory-returning endpoint
 * answers with this shape, so create/read/update share the single name.
 */
export interface TrajectoryRecord extends TrajectoryProps {
    _id: string;
}

export interface GetTrajectoriesByTeamIdInput {
    teamId: string;
    page?: number;
    limit?: number;
    folderId?: string;
    search?: string;
}

export interface UpdateTrajectoryByIdInput {
    trajectoryId: string;
    name: string;
    isPublic: boolean;
}

export interface MoveTrajectoryInput extends WireMoveTrajectoryInput {
    teamId: string;
    trajectoryId: string;
}

export interface TrajectoryPreviewResult {
    base64: string;
    etag: string;
}

export interface PublicTeamDiscoveryView {
    _id: string;
    name: string;
}

export interface ListPublicTeamTrajectoriesInput {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
}

export interface ListPublicTeamTrajectoriesOutput extends PaginatedResult<TrajectoryRecord> {
    _meta: {
        team: PublicTeamDiscoveryView;
    };
}

export interface CloneTrajectoryInput extends WireCloneTrajectoryInput {
    teamId: string;
    userId: string;
}

export interface CloneTrajectoryOutput {
    trajectoryId: string;
    jobId: string;
    sourceTrajectoryId: string;
    destinationClusterId: string;
}

export interface DownloadTrajectoryInput {
    trajectoryId: string;
    teamId: string;
    userId: string;
    name?: string;
    archive?: boolean;
}

export interface DownloadTrajectoryAnalysesInput {
    trajectoryId: string;
    teamId: string;
    name?: string;
}

export interface DownloadSampleSimulationsOutput {
    stream: ReadStream;
    filename: string;
}

export interface CreateTrajectoryUploadSessionInput extends WireCreateTrajectoryUploadSessionInput {
    userId: string;
    teamId: string;
}

interface TrajectoryUploadPartView {
    partNumber: number;
    offset: number;
    size: number;
    url: string;
    expiresAt: string;
}

export interface TrajectoryUploadSessionFileView {
    index: number;
    originalName: string;
    size: number;
    contentType?: string;
    finalObjectKey: string;
    parts: TrajectoryUploadPartView[];
}

export interface CreateTrajectoryUploadSessionOutput {
    trajectory: TrajectoryRecord;
    uploadSession: {
        id: string;
        chunkSize: number;
        expiresAt: string;
        files: TrajectoryUploadSessionFileView[];
    };
}

/** Commit and cancel address an upload session the same way. */
export interface TrajectoryUploadSessionRequest {
    teamId: string;
    userId: string;
    uploadSessionId: string;
}

/**
 * The trajectory/timestep pair every model derivation is scoped by, optionally
 * narrowed to one analysis exposure.
 */
export interface TrajectoryExposureScope {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
}

export interface CreateColoredModelInput extends WireCreateColoredModelInput {
    trajectoryId: string;
}

export interface GetColorCodingPropertiesOutput {
    base: string[];
    modifiers: Record<string, string[]>;
    modifierTypes: Record<string, Record<string, 'number' | 'string'>>;
}

export interface GetColorCodingStatsInput extends TrajectoryExposureScope {
    property: string;
    type: string;
}

export interface GetColorCodingStatsOutput {
    min: number;
    max: number;
}

interface ParticleFilterConditionRequestInput {
    property: string;
    operator: string;
    value: number | string;
    exposureId?: string;
}

export interface PreviewParticleFilterInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionRequestInput[];
}

export interface PreviewParticleFilterOutput {
    matchCount: number;
    totalAtoms: number;
}

export interface ApplyParticleFilterActionInput extends PreviewParticleFilterInput {
    action: 'delete' | 'highlight';
}

export interface ApplyParticleFilterActionOutput {
    fileId: string;
    atomsResult: number;
    action: string;
}

export interface GetFilteredModelStreamInput extends PreviewParticleFilterInput {
    action?: string;
}

export interface GetParticleFilterPropertiesOutput {
    dump: string[];
    perAtom: Record<string, string[]>;
    perAtomTypes: Record<string, Record<string, 'number' | 'string'>>;
    exposureNames: Record<string, string>;
}

export interface GetParticleFilterUniqueValuesInput extends TrajectoryExposureScope {
    property: string;
    maxValues?: number;
}

export interface GetParticleFilterUniqueValuesOutput {
    values: Array<number | string>;
}

/** Line derivations always target one baked exposure, so both ids are required. */
export interface LineExposureScope {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
}

export interface ListTeamSceneArtifactsInput {
    teamId: string;
    sourceType?: SceneArtifactProps['sourceType'];
    analysisId?: string;
    timestep?: number;
    page?: number;
    limit?: number;
}

export interface ListTrajectorySceneArtifactsInput {
    trajectoryId: string;
    sourceType?: SceneArtifactSourceType;
    analysisId?: string;
    projection?: 'raw' | 'renderable-exposures';
    timestep?: number;
    page?: number;
    limit?: number;
}

export enum PublicCanvasAccessMode {
    ReadOnly = 'read-only'
}

interface PublicCanvasFrameView {
    timestep: number;
    natoms: number;
    simulationCell: string;
}

export interface PublicCanvasBootstrapTrajectoryView {
    _id: string;
    name: string;
    status: string;
    isPublic: boolean;
    teamId: string;
    analysisIds: string[];
    frames: PublicCanvasFrameView[];
}

export interface GetPublicCanvasBootstrapOutput {
    access: {
        mode: PublicCanvasAccessMode;
        isGuest: boolean;
        isPublic: boolean;
        hasTeamMembership: boolean;
    };
    trajectory: PublicCanvasBootstrapTrajectoryView;
}

export interface GetPublicCanvasGLBInput {
    trajectoryId: string;
    timestep: string;
    userId?: string;
    acceptEncoding?: string;
}

export interface GetPublicCanvasGLBOutput {
    stream: Readable;
    size?: number;
    objectName: string;
    contentEncoding: GlbContentEncoding;
    /* Set only when the request advertised the codec; see `getClusterGlbStream`. */
    negotiatedContentEncoding: 'zstd' | null;
    etag?: string;
    lastModified?: Date;
}

export interface GetPublicCanvasRasterFrameInput {
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
    userId?: string;
}

export interface GetAtomsColumnarInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    page?: number;
    limit?: number;
}

export type AtomColumnDType = 'f32' | 'u32' | 'u16' | 'str' | 'i32';

export interface AtomColumn {
    name: string;
    dtype: AtomColumnDType;
    buffer: Uint8Array;
}

export interface GetAtomsColumnarOutput {
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    columns: AtomColumn[];
    propertyNames: string[];
}

export type { TrajectoryUploadFileInput };
