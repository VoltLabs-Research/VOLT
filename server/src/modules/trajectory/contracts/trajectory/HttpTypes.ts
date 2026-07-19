import type { TrajectoryProps } from '@shared/contracts/types/Trajectory';
import type {
    SceneArtifactProps,
    SceneArtifactSourceType
} from '@shared/contracts/types/SceneArtifact';
import type {
    CreateLineStyledModelResult,
    LineStyleSpec
} from '@modules/trajectory/services/line-style/LineStyleService';
import { ParticleFilterCombinator } from '@modules/trajectory/services/particle-filter/ParticleFilterService';
import type { TeamMetricsSnapshot } from '@modules/trajectory/contracts/trajectory/TeamMetrics';
import type { GlbContentEncoding } from '@shared/application/utilities/glb-stream-resolution';
import type { DownloadStreamOutput } from '@shared/contracts/types';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { Readable } from 'node:stream';
import type { ReadStream } from 'node:fs';

export { ParticleFilterCombinator };

export interface CreateTrajectoryOutput extends TrajectoryProps {
    _id: string;
}

export interface TrajectoryRecord extends TrajectoryProps {
    _id: string;
}

export interface GetTrajectoryByIdOutput extends TrajectoryProps {
    _id: string;
}

export interface GetTrajectoriesByTeamIdInput {
    teamId: string;
    page?: number;
    limit?: number;
    folderId?: string;
    search?: string;
}

export interface GetTrajectoriesByTeamIdOutput extends PaginatedResult<TrajectoryRecord> {}

export interface UpdateTrajectoryByIdInput {
    trajectoryId: string;
    name: string;
    isPublic: boolean;
}

export interface UpdateTrajectoryByIdOutput extends TrajectoryProps {
    _id: string;
}

export interface MoveTrajectoryInput {
    teamId: string;
    trajectoryId: string;
    folderId: string | null;
}

export type MoveTrajectoryOutput = null;

export interface GetTeamMetricsInput {
    teamId: string;
}

export type GetTeamMetricsResult = TeamMetricsSnapshot;
export type GetTeamMetricsOutput = GetTeamMetricsResult;

export interface GetTrajectoryPreviewInput {
    trajectoryId: string;
}

export interface GetTrajectoryPreviewOutput {
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

export interface CloneTrajectoryInput {
    teamId: string;
    userId: string;
    sourceTrajectoryId: string;
    targetClusterId?: string;
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

export interface DownloadTrajectoryOutput {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}

export interface DownloadTrajectoryAnalysesInput {
    trajectoryId: string;
    teamId: string;
    name?: string;
}

export interface DownloadTrajectoryAnalysesOutput {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}

export interface DownloadSampleSimulationsInput {
    filename?: string;
}

export interface DownloadSampleSimulationsOutput {
    stream: ReadStream;
    filename: string;
}

export interface TrajectoryUploadSessionFileInput {
    name: string;
    size: number;
    type?: string;
}

export interface CreateTrajectoryUploadSessionInput {
    name: string;
    files: TrajectoryUploadSessionFileInput[];
    userId: string;
    teamId: string;
    teamClusterId?: string;
    folderId?: string | null;
}

export interface TrajectoryUploadPartView {
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
    trajectory: CreateTrajectoryOutput;
    uploadSession: {
        id: string;
        chunkSize: number;
        expiresAt: string;
        files: TrajectoryUploadSessionFileView[];
    };
}

export interface CommitTrajectoryUploadSessionInput {
    teamId: string;
    userId: string;
    uploadSessionId: string;
}

export interface CommitTrajectoryUploadSessionOutput {
    trajectoryId: string;
}

export interface CancelTrajectoryUploadSessionInput {
    teamId: string;
    userId: string;
    uploadSessionId: string;
}

export interface CreateColoredModelInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
}

export type CreateColoredModelOutput = null;

export interface GetColorCodingPropertiesInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
}

export interface GetColorCodingPropertiesOutput {
    base: string[];
    modifiers: Record<string, string[]>;
    modifierTypes: Record<string, Record<string, 'number' | 'string'>>;
}

export interface GetColorCodingStatsInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    type: string;
}

export interface GetColorCodingStatsOutput {
    min: number;
    max: number;
}

export interface GetColoredModelStreamInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
}

export interface GetColoredModelStreamOutput {
    stream: Readable;
}

export interface ParticleFilterConditionRequestInput {
    kind?: 'property';
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
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

export interface ApplyParticleFilterActionInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    action: 'delete' | 'highlight';
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionRequestInput[];
}

export interface ApplyParticleFilterActionOutput {
    fileId: string;
    atomsResult: number;
    action: string;
}

export interface GetFilteredModelStreamInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    action?: string;
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionRequestInput[];
}

export interface GetFilteredModelStreamOutput {
    stream: Readable;
}

export interface GetParticleFilterPropertiesInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
}

export interface GetParticleFilterPropertiesOutput {
    dump: string[];
    perAtom: Record<string, string[]>;
    perAtomTypes: Record<string, Record<string, 'number' | 'string'>>;
    exposureNames: Record<string, string>;
}

export interface GetParticleFilterUniqueValuesInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    maxValues?: number;
}

export interface GetParticleFilterUniqueValuesOutput {
    values: Array<number | string>;
}

export interface CreateLineStyledModelInput {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    style?: LineStyleSpec;
}

export type CreateLineStyledModelOutput = CreateLineStyledModelResult;

export interface GetLineStyledModelStreamInput {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    style?: string;
}

export interface GetLineStyledModelStreamOutput {
    stream: Readable;
}

export interface GetLineModelRangesStreamInput {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    style?: string;
}

export interface GetOctreeMetadataStreamInput {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
}

export interface GetLineEntityPropertiesInput {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    entityId: string;
}

export interface GetLineEntityPropertiesOutput {
    entityId: number;
    properties: Record<string, unknown>;
}

export interface TeamSceneArtifactOutput {
    _id: string;
    trajectory: SceneArtifactProps['trajectory'];
    storageClusterId?: SceneArtifactProps['storageClusterId'];
    analysis?: SceneArtifactProps['analysis'];
    plugin?: SceneArtifactProps['plugin'];
    sourceType: SceneArtifactProps['sourceType'];
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactProps['params'];
    displayName: string;
    status: SceneArtifactProps['status'];
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface ListTeamSceneArtifactsInput {
    teamId: string;
    sourceType?: SceneArtifactProps['sourceType'];
    analysisId?: string;
    timestep?: number;
    page?: number;
    limit?: number;
}

export interface ListTeamSceneArtifactsOutput extends PaginatedResult<TeamSceneArtifactOutput> {}

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

export interface GetPublicCanvasBootstrapInput {
    trajectoryId: string;
    userId?: string;
}

export interface PublicCanvasFrameView {
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

export interface PublicCanvasAccessView {
    mode: PublicCanvasAccessMode;
    isGuest: boolean;
    isPublic: boolean;
    hasTeamMembership: boolean;
}

export interface GetPublicCanvasBootstrapOutput {
    access: PublicCanvasAccessView;
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
}

export interface GetPublicCanvasRasterFrameInput {
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
    userId?: string;
}

export type GetPublicCanvasRasterFrameOutput = DownloadStreamOutput;
