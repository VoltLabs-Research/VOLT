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
import type { DownloadStreamOutputDTO } from '@shared/contracts/types';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { Readable } from 'node:stream';
import type { ReadStream } from 'node:fs';

export { ParticleFilterCombinator };

export interface CreateTrajectoryOutputDTO extends TrajectoryProps {
    _id: string;
}

export interface TrajectoryPersistedDTO extends TrajectoryProps {
    _id: string;
}

export interface GetTrajectoryByIdOutputDTO extends TrajectoryProps {
    _id: string;
}

export interface GetTrajectoriesByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    folderId?: string;
    search?: string;
}

export interface GetTrajectoriesByTeamIdOutputDTO extends PaginatedResult<TrajectoryPersistedDTO> {}

export interface UpdateTrajectoryByIdInputDTO {
    trajectoryId: string;
    name: string;
    isPublic: boolean;
}

export interface UpdateTrajectoryByIdOutputDTO extends TrajectoryProps {
    _id: string;
}

export interface MoveTrajectoryInputDTO {
    teamId: string;
    trajectoryId: string;
    folderId: string | null;
}

export type MoveTrajectoryOutputDTO = null;

export interface GetTeamMetricsInputDTO {
    teamId: string;
}

export type GetTeamMetricsResultDTO = TeamMetricsSnapshot;
export type GetTeamMetricsOutputDTO = GetTeamMetricsResultDTO;

export interface GetTrajectoryPreviewInputDTO {
    trajectoryId: string;
}

export interface GetTrajectoryPreviewOutputDTO {
    base64: string;
    etag: string;
}

export interface PublicTeamDiscoveryDTO {
    _id: string;
    name: string;
}

export interface ListPublicTeamTrajectoriesInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
}

export interface ListPublicTeamTrajectoriesOutputDTO extends PaginatedResult<TrajectoryPersistedDTO> {
    _meta: {
        team: PublicTeamDiscoveryDTO;
    };
}

export interface CloneTrajectoryInputDTO {
    teamId: string;
    userId: string;
    sourceTrajectoryId: string;
    targetClusterId?: string;
}

export interface CloneTrajectoryOutputDTO {
    trajectoryId: string;
    jobId: string;
    sourceTrajectoryId: string;
    destinationClusterId: string;
}

export interface DownloadTrajectoryInputDTO {
    trajectoryId: string;
    teamId: string;
    userId: string;
    name?: string;
    archive?: boolean;
}

export interface DownloadTrajectoryOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}

export interface DownloadTrajectoryAnalysesInputDTO {
    trajectoryId: string;
    teamId: string;
    name?: string;
}

export interface DownloadTrajectoryAnalysesOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}

export interface DownloadSampleSimulationsInputDTO {
    filename?: string;
}

export interface DownloadSampleSimulationsOutputDTO {
    stream: ReadStream;
    filename: string;
}

export interface TrajectoryUploadSessionFileInput {
    name: string;
    size: number;
    type?: string;
}

export interface CreateTrajectoryUploadSessionInputDTO {
    name: string;
    files: TrajectoryUploadSessionFileInput[];
    userId: string;
    teamId: string;
    teamClusterId?: string;
    folderId?: string | null;
}

export interface TrajectoryUploadPartDTO {
    partNumber: number;
    offset: number;
    size: number;
    url: string;
    expiresAt: string;
}

export interface TrajectoryUploadSessionFileDTO {
    index: number;
    originalName: string;
    size: number;
    contentType?: string;
    finalObjectKey: string;
    parts: TrajectoryUploadPartDTO[];
}

export interface CreateTrajectoryUploadSessionOutputDTO {
    trajectory: CreateTrajectoryOutputDTO;
    uploadSession: {
        id: string;
        chunkSize: number;
        expiresAt: string;
        files: TrajectoryUploadSessionFileDTO[];
    };
}

export interface CommitTrajectoryUploadSessionInputDTO {
    teamId: string;
    userId: string;
    uploadSessionId: string;
}

export interface CommitTrajectoryUploadSessionOutputDTO {
    trajectoryId: string;
}

export interface CancelTrajectoryUploadSessionInputDTO {
    teamId: string;
    userId: string;
    uploadSessionId: string;
}

export interface CreateColoredModelInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
}

export type CreateColoredModelOutputDTO = null;

export interface GetColorCodingPropertiesInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
}

export interface GetColorCodingPropertiesOutputDTO {
    base: string[];
    modifiers: Record<string, string[]>;
    modifierTypes: Record<string, Record<string, 'number' | 'string'>>;
}

export interface GetColorCodingStatsInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    type: string;
}

export interface GetColorCodingStatsOutputDTO {
    min: number;
    max: number;
}

export interface GetColoredModelStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
}

export interface GetColoredModelStreamOutputDTO {
    stream: Readable;
}

export interface ParticleFilterConditionDTO {
    kind?: 'property';
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number | string;
    exposureId?: string;
}

export interface PreviewParticleFilterInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionDTO[];
}

export interface PreviewParticleFilterOutputDTO {
    matchCount: number;
    totalAtoms: number;
}

export interface ApplyParticleFilterActionInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    action: 'delete' | 'highlight';
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionDTO[];
}

export interface ApplyParticleFilterActionOutputDTO {
    fileId: string;
    atomsResult: number;
    action: string;
}

export interface GetFilteredModelStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    action?: string;
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionDTO[];
}

export interface GetFilteredModelStreamOutputDTO {
    stream: Readable;
}

export interface GetParticleFilterPropertiesInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
}

export interface GetParticleFilterPropertiesOutputDTO {
    dump: string[];
    perAtom: Record<string, string[]>;
    perAtomTypes: Record<string, Record<string, 'number' | 'string'>>;
    exposureNames: Record<string, string>;
}

export interface GetParticleFilterUniqueValuesInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    maxValues?: number;
}

export interface GetParticleFilterUniqueValuesOutputDTO {
    values: Array<number | string>;
}

export interface CreateLineStyledModelInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    style?: LineStyleSpec;
}

export type CreateLineStyledModelOutputDTO = CreateLineStyledModelResult;

export interface GetLineStyledModelStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    style?: string;
}

export interface GetLineStyledModelStreamOutputDTO {
    stream: Readable;
}

export interface GetLineModelRangesStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    style?: string;
}

export interface GetOctreeMetadataStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
}

export interface GetLineEntityPropertiesInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    entityId: string;
}

export interface GetLineEntityPropertiesOutputDTO {
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

export interface ListTeamSceneArtifactsInputDTO {
    teamId: string;
    sourceType?: SceneArtifactProps['sourceType'];
    analysisId?: string;
    timestep?: number;
    page?: number;
    limit?: number;
}

export interface ListTeamSceneArtifactsOutputDTO extends PaginatedResult<TeamSceneArtifactOutput> {}

export interface ListTrajectorySceneArtifactsInputDTO {
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

export interface GetPublicCanvasBootstrapInputDTO {
    trajectoryId: string;
    userId?: string;
}

export interface PublicCanvasFrameDTO {
    timestep: number;
    natoms: number;
    simulationCell: string;
}

export interface PublicCanvasBootstrapTrajectoryDTO {
    _id: string;
    name: string;
    status: string;
    isPublic: boolean;
    teamId: string;
    analysisIds: string[];
    frames: PublicCanvasFrameDTO[];
}

export interface PublicCanvasAccessDTO {
    mode: PublicCanvasAccessMode;
    isGuest: boolean;
    isPublic: boolean;
    hasTeamMembership: boolean;
}

export interface GetPublicCanvasBootstrapOutputDTO {
    access: PublicCanvasAccessDTO;
    trajectory: PublicCanvasBootstrapTrajectoryDTO;
}

export interface GetPublicCanvasGLBInputDTO {
    trajectoryId: string;
    timestep: string;
    userId?: string;
    acceptEncoding?: string;
}

export interface GetPublicCanvasGLBOutputDTO {
    stream: Readable;
    size?: number;
    objectName: string;
    contentEncoding: GlbContentEncoding;
}

export interface GetPublicCanvasRasterFrameInputDTO {
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
    userId?: string;
}

export type GetPublicCanvasRasterFrameOutputDTO = DownloadStreamOutputDTO;
