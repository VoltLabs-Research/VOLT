import { ErrorCodes } from '@core/constants/error-codes';
import { STATIC_ROOT } from '@core/config/paths';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import TrajectoryFrameModel, { TrajectoryFrameLean } from '@modules/trajectory/models/trajectory/TrajectoryFrameModel';
import TrajectoryUploadSessionModel from '@modules/trajectory/models/trajectory/TrajectoryUploadSessionModel';
import SceneArtifactModel, { SceneArtifactDocument } from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';

import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';
import type { TrajectoryFrame, TrajectoryFrameSimulationCellEmbed } from '@shared/contracts/types/Trajectory';
import TrajectoryCloneJobModel, { createTrajectoryCloneJobProps } from '@modules/trajectory/models/trajectory/TrajectoryCloneJobModel';

import trajectoryNativeDaemonService from '@modules/trajectory/services/native/TrajectoryNativeDaemonService';
import trajectoryReader from '@modules/trajectory/services/trajectory/TrajectoryReader';
import colorCodingService from '@modules/trajectory/services/color-coding/ColorCodingService';
import particleFilterService from '@modules/trajectory/services/particle-filter/ParticleFilterService';
import lineStyleService, { type LineStyleSpec } from '@modules/trajectory/services/line-style/LineStyleService';
import atomPropertiesService from '@modules/trajectory/services/trajectory/AtomPropertiesService';
import trajectoryDumpStorageService from '@modules/trajectory/services/trajectory/TrajectoryDumpStorageService';
import teamMetricsQueryService from '@modules/trajectory/services/trajectory/TeamMetricsQueryService';
import trajectoryCloneRunner from '@modules/trajectory/services/trajectory/TrajectoryCloneRunner';

import trajectoryCloneCoordinator from '@modules/trajectory/services/TrajectoryCloneCoordinator';

import TrajectoryCreatedEvent from '@modules/trajectory/events/trajectory/TrajectoryCreatedEvent';
import TrajectoryUpdatedEvent from '@modules/trajectory/events/trajectory/TrajectoryUpdatedEvent';
import TrajectoryDeletedEvent from '@modules/trajectory/events/trajectory/TrajectoryDeletedEvent';

import {
    buildTrajectoryDumpObjectName,
    buildTrajectoryGlbObjectName
} from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import { buildParticleFilterRequest } from '@modules/trajectory/utilities/build-particle-filter-request';
import { readTrajectoryPreview } from '@modules/trajectory/utilities/trajectory/read-trajectory-preview';
import { normalizeAnalysisId } from '@modules/trajectory/utilities/trajectory/modifier-data';

import RasterService from '@modules/raster/services/RasterService';
import SimulationCellService from '@modules/simulation-cell/services/SimulationCellService';

import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { resolveAnalysisComputeClusterId } from '@shared/application/utilities/cluster-location';
import { resolveEffectiveCapabilitiesFromRoleConfig } from '@shared/domain/utilities/cluster-capabilities';
import { extractPluginId } from '@shared/application/utilities/extract-plugin-id';
import { getClusterGlbStream } from '@shared/application/utilities/glb-stream-resolution';
import {
    createDownloadStreamResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { TeamClusterStatus } from '@shared/contracts/types';
import type { Analysis, DownloadStreamOutputDTO } from '@shared/contracts/types';
import { USER_POPULATE, STORAGE_CLUSTER_POPULATE, TRAJECTORY_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { CLUSTER_ACCESS_TOKENS, CLUSTER_SERVICE_TOKENS, COMPUTE_TOKENS } from '@shared/contracts/tokens';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import ClusterObjectSignedUrlService from '@modules/cluster/services/ClusterObjectSignedUrlService';
import ClusterObjectArchiveService from '@modules/cluster/services/ClusterObjectArchiveService';
import TeamClusterRepository from '@modules/cluster/repositories/TeamClusterRepository';
import storagePlacementService from '@modules/cluster/services/StoragePlacementService';
import daemonAnalysisCompletionService from '@modules/cluster/services/DaemonAnalysisCompletionService';
import type {
    IAnalysisRepository,
    ITeamClusterObjectGatewayClient,
    ITeamClusterSelectionService,
    IStoragePlacementService,
    ClusterArchiveReference,
    ClusterArchiveObjectEntry,
    IDaemonAnalysisCompletionService
} from '@shared/contracts/ports';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import AnalysisRepository from '@modules/analysis/repositories/AnalysisRepository';
import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import PluginService from '@modules/plugin/services/PluginService';
import SimulationCellRepositoryAdapter from '@modules/simulation-cell/services/SimulationCellRepositoryAdapter';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

import mongoose from 'mongoose';
import type { PipelineStage } from 'mongoose';
import sharp from 'sharp';
import pLimit from 'p-limit';
import { v4 } from 'uuid';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { container as diContainer } from 'tsyringe';

import type {
    CreateTrajectoryOutputDTO,
    TrajectoryPersistedDTO,
    GetTrajectoryByIdOutputDTO,
    GetTrajectoriesByTeamIdInputDTO,
    GetTrajectoriesByTeamIdOutputDTO,
    UpdateTrajectoryByIdInputDTO,
    UpdateTrajectoryByIdOutputDTO,
    MoveTrajectoryInputDTO,
    MoveTrajectoryOutputDTO,
    GetTeamMetricsInputDTO,
    GetTeamMetricsOutputDTO,
    GetTrajectoryPreviewInputDTO,
    GetTrajectoryPreviewOutputDTO,
    PublicTeamDiscoveryDTO,
    ListPublicTeamTrajectoriesInputDTO,
    ListPublicTeamTrajectoriesOutputDTO,
    CloneTrajectoryInputDTO,
    CloneTrajectoryOutputDTO,
    DownloadTrajectoryInputDTO,
    DownloadTrajectoryOutputDTO,
    DownloadTrajectoryAnalysesInputDTO,
    DownloadTrajectoryAnalysesOutputDTO,
    DownloadSampleSimulationsInputDTO,
    DownloadSampleSimulationsOutputDTO,
    TrajectoryUploadSessionFileInput,
    CreateTrajectoryUploadSessionInputDTO,
    CreateTrajectoryUploadSessionOutputDTO,
    TrajectoryUploadSessionFileDTO,
    CommitTrajectoryUploadSessionInputDTO,
    CommitTrajectoryUploadSessionOutputDTO,
    CancelTrajectoryUploadSessionInputDTO,
    CreateColoredModelInputDTO,
    CreateColoredModelOutputDTO,
    GetColorCodingPropertiesInputDTO,
    GetColorCodingPropertiesOutputDTO,
    GetColorCodingStatsInputDTO,
    GetColorCodingStatsOutputDTO,
    GetColoredModelStreamInputDTO,
    GetColoredModelStreamOutputDTO,
    PreviewParticleFilterInputDTO,
    PreviewParticleFilterOutputDTO,
    ApplyParticleFilterActionInputDTO,
    ApplyParticleFilterActionOutputDTO,
    GetFilteredModelStreamInputDTO,
    GetFilteredModelStreamOutputDTO,
    GetParticleFilterPropertiesInputDTO,
    GetParticleFilterPropertiesOutputDTO,
    GetParticleFilterUniqueValuesInputDTO,
    GetParticleFilterUniqueValuesOutputDTO,
    CreateLineStyledModelInputDTO,
    CreateLineStyledModelOutputDTO,
    GetLineStyledModelStreamInputDTO,
    GetLineStyledModelStreamOutputDTO,
    GetLineModelRangesStreamInputDTO,
    GetOctreeMetadataStreamInputDTO,
    GetLineEntityPropertiesInputDTO,
    GetLineEntityPropertiesOutputDTO,
    TeamSceneArtifactOutput,
    ListTeamSceneArtifactsInputDTO,
    ListTeamSceneArtifactsOutputDTO,
    ListTrajectorySceneArtifactsInputDTO,
    GetPublicCanvasBootstrapInputDTO,
    GetPublicCanvasBootstrapOutputDTO,
    PublicCanvasBootstrapTrajectoryDTO,
    GetPublicCanvasGLBInputDTO,
    GetPublicCanvasGLBOutputDTO,
    GetPublicCanvasRasterFrameInputDTO,
    GetPublicCanvasRasterFrameOutputDTO
} from '@modules/trajectory/contracts/trajectory/HttpTypes';
import { PublicCanvasAccessMode } from '@modules/trajectory/contracts/trajectory/HttpTypes';
import type {
    GetAtomsColumnarInputDTO,
    GetAtomsColumnarOutputDTO,
    AtomColumn
} from '@modules/trajectory/contracts/trajectory/ServiceTypes';
import type { GetRasterMetadataOutputDTO } from '@shared/contracts/dtos/GetRasterMetadataDTO';
import type { GetSimulationCellByTrajectoryOutputDTO } from '@shared/contracts/dtos/GetSimulationCellByTrajectoryDTO';
import type { GetAnalysisFrameLogOutputDTO } from '@shared/contracts/dtos/GetAnalysisFrameLogDTO';
import type { GetPluginExposureGLBOutputDTO, GetPluginByIdOutputDTO, GetPluginListingDocumentsOutputDTO, GetSubListingOutputDTO } from '@shared/contracts/dtos';
import type { GetAnalysesByTrajectoryIdOutputDTO } from '@shared/contracts/dtos/GetAnalysesByTrajectoryIdDTO';

type TrajectoryDoc = mongoose.Document & {
    _id: mongoose.Types.ObjectId;
    name: string;
    team: mongoose.Types.ObjectId;
    folder: string | null;
    storageClusterId?: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    status: TrajectoryStatus;
    isPublic: boolean;
    rasterSceneViews: number;
    hasPreview?: boolean;
    stats: { totalFiles: number; totalSize: number };
    analysis?: string[];
    createdAt: Date;
    updatedAt: Date;
    save(): Promise<unknown>;
    toObject(): Record<string, unknown>;
};

interface TrajectoryFolderView {
    _id: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface TrajectoryFolderQuery {
    parentId?: string | null;
    page?: number;
    limit?: number;
}

interface TrajectoryIngestResult {
    trajectoryId: string;
    frames: Array<{
        timestep: number;
        natoms: number;
        headers: string[];
        simulationCell: { boundingBox: unknown; geometry: unknown } | null;
        size: number;
        objectKey: string;
    }>;
    stats: { totalFiles: number; totalSize: number };
}

interface QueuedGlbJob {
    jobId: string;
    teamId: string;
    queueType: string;
    name: string;
    trajectoryId: string;
    trajectoryName: string;
    timestep: number;
}

const GLB_QUEUE_TYPE = 'trajectory_glb_conversion';
const GLB_JOB_NAME = 'Preprocess trajectory frame';
const SAMPLES_PATH = path.join(STATIC_ROOT, 'default/simulations');
const DASHBOARD_PREVIEW_MAX_WIDTH = 960;
const DASHBOARD_PREVIEW_MAX_HEIGHT = 540;
const ANALYSIS_STATUS_COMPLETED = 'completed';
const ANALYSIS_EXPORT_CONCURRENCY = 8;
const DEFAULT_UPLOAD_CHUNK_SIZE = 64 * 1024 * 1024;
const DEFAULT_UPLOAD_SESSION_TTL_SECONDS = 6 * 60 * 60;
const TRAJECTORY_UPLOAD_CHUNK_SIZE = readPositiveIntegerEnv('TRAJECTORY_UPLOAD_CHUNK_SIZE', DEFAULT_UPLOAD_CHUNK_SIZE);
const TRAJECTORY_UPLOAD_SESSION_TTL_SECONDS = readPositiveIntegerEnv(
    'TRAJECTORY_UPLOAD_SESSION_TTL_SECONDS',
    DEFAULT_UPLOAD_SESSION_TTL_SECONDS
);
const RENDERABLE_SCENE_EXPORTERS = new Set(['AtomisticExporter', 'MeshExporter', 'LineExporter']);

const isNoValidFramesError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : '';
    return /no valid trajectory frames/i.test(message);
};

const readFilenameFromContentDisposition = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
    const quotedMatch = value.match(/filename="([^"]+)"/i);
    if (quotedMatch?.[1]) return quotedMatch[1];
    const bareMatch = value.match(/filename=([^;]+)/i);
    return bareMatch?.[1]?.trim();
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const storageClusterIdOf = (doc: { storageClusterId?: mongoose.Types.ObjectId | string }): string | undefined => (
    doc.storageClusterId ? String(doc.storageClusterId) : undefined
);

const resolveTrajectoryName = (
    requestedName: string | undefined,
    files: TrajectoryUploadSessionFileInput[]
): string | null => {
    const normalizedRequestedName = requestedName?.trim();
    if (normalizedRequestedName) return normalizedRequestedName;
    const firstFileName = files[0]?.name?.trim();
    return firstFileName ? path.basename(firstFileName) : null;
};

const safeObjectName = (name: string): string => path.basename(name || 'upload');

const buildUploadParts = (
    trajectoryId: string,
    fileIndex: number,
    finalObjectKey: string,
    size: number
): Array<{ partNumber: number; objectKey: string; offset: number; size: number }> => {
    if (size <= TRAJECTORY_UPLOAD_CHUNK_SIZE) {
        return [{ partNumber: 1, objectKey: finalObjectKey, offset: 0, size }];
    }

    const parts: Array<{ partNumber: number; objectKey: string; offset: number; size: number }> = [];
    let offset = 0;
    let partNumber = 1;

    while (offset < size) {
        const partSize = Math.min(TRAJECTORY_UPLOAD_CHUNK_SIZE, size - offset);
        parts.push({
            partNumber,
            objectKey: `trajectory-staging/${trajectoryId}/parts/${fileIndex}/${partNumber}`,
            offset,
            size: partSize
        });
        offset += partSize;
        partNumber += 1;
    }

    return parts;
};

const parseLineStyle = (style: string | undefined): LineStyleSpec => {
    if (!style) return {};
    try {
        return JSON.parse(style) as LineStyleSpec;
    } catch {
        throw ApplicationError.badRequest(
            'LINE_STYLE_INVALID',
            'The "style" query parameter must be a JSON-encoded line style.'
        );
    }
};

interface SimulationCellPopulated {
    _id: mongoose.Types.ObjectId | string;
    boundingBox: { width: number; height: number; length: number };
    geometry: {
        cell_vectors: number[][];
        cell_origin: number[];
        periodic_boundary_conditions: { x: boolean; y: boolean; z: boolean };
    };
    team?: mongoose.Types.ObjectId | string;
    trajectory?: mongoose.Types.ObjectId | string;
    timestep: number;
    createdAt?: Date;
    updatedAt?: Date;
}

type TrajectoryFrameLeanWithPopulatedCell = Omit<TrajectoryFrameLean, 'simulationCell'> & {
    simulationCell: SimulationCellPopulated | mongoose.Types.ObjectId;
};

const isPopulatedSimulationCell = (value: unknown): value is SimulationCellPopulated => (
    typeof value === 'object' && value !== null && 'boundingBox' in value && 'geometry' in value
);

const toPopulatedSimulationCell = (value: SimulationCellPopulated): TrajectoryFrameSimulationCellEmbed => ({
    _id: value._id.toString(),
    boundingBox: value.boundingBox,
    geometry: value.geometry,
    team: value.team?.toString(),
    trajectory: value.trajectory?.toString(),
    timestep: value.timestep,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
});

const mapFrameLean = (doc: TrajectoryFrameLeanWithPopulatedCell): TrajectoryFrame => ({
    timestep: doc.timestep,
    natoms: doc.natoms,
    simulationCell: doc.simulationCell
        ? (isPopulatedSimulationCell(doc.simulationCell)
            ? toPopulatedSimulationCell(doc.simulationCell)
            : doc.simulationCell.toString())
        : undefined
});

export default class TrajectoryService {
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);
    #objectGatewayClient = diContainer.resolve<ITeamClusterObjectGatewayClient>(SHARED_TOKENS.TeamClusterObjectGatewayClient);
    #teamClusterDaemonClient = diContainer.resolve<ITeamClusterDaemonClient>(SHARED_TOKENS.TeamClusterDaemonClient);
    #clusterSelection = diContainer.resolve<ITeamClusterSelectionService>(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService);
    #storagePlacement = storagePlacementService;
    #signedUrlService = new ClusterObjectSignedUrlService();
    #archiveService = new ClusterObjectArchiveService();
    #teamClusterRepository = new TeamClusterRepository();
    #daemonAnalysisCompletionService: IDaemonAnalysisCompletionService = daemonAnalysisCompletionService;
    #simulationCellRepository = new SimulationCellRepositoryAdapter();
    #analysisRepository: IAnalysisRepository = new AnalysisRepository();
    #teamRepository = diContainer.resolve<ITeamRepository>(TEAM_CONTRACT_TOKENS.TeamRepository);
    #teamMemberRepository = diContainer.resolve<ITeamMemberRepository>(TEAM_CONTRACT_TOKENS.TeamMemberRepository);
    #pluginService = new PluginService();
    #analysisService = new AnalysisService();

    #nativeDaemon = trajectoryNativeDaemonService;
    #reader = trajectoryReader;
    #colorCoding = colorCodingService;
    #particleFilter = particleFilterService;
    #lineStyle = lineStyleService;
    #atomProperties = atomPropertiesService;
    #dumpStorage = trajectoryDumpStorageService;
    #teamMetrics = teamMetricsQueryService;
    #cloneCoordinator = trajectoryCloneCoordinator;
    #cloneRunner = trajectoryCloneRunner;


    async createUploadSession(input: CreateTrajectoryUploadSessionInputDTO): Promise<CreateTrajectoryUploadSessionOutputDTO> {
        const { teamId, userId } = input;
        const files = Array.isArray(input.files) ? input.files : [];
        const name = resolveTrajectoryName(input.name, files);

        if (!name || files.length === 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'At least one uploaded trajectory file is required'
            );
        }

        if (files.some((file) => !file.name || !Number.isFinite(file.size) || file.size <= 0)) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Each uploaded trajectory file must include a name and positive size'
            );
        }

        if (input.folderId) {
            const folder = await CatalogFolderModel.findOne({ _id: input.folderId, team: teamId, kind: CatalogFolderKind.Trajectory });
            if (!folder) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target trajectory folder not found');
            }
        }

        const storageClusterId = await this.#clusterSelection.resolveStorageClusterId(teamId, input.teamClusterId);
        const ext = path.extname(name);
        const cleanName = ext ? name.slice(0, -ext.length) : name;

        const trajectory = await this.#createTrajectoryDocument({
            name: cleanName,
            team: teamId,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: userId,
            status: TrajectoryStatus.Processing,
            stats: { totalFiles: 0, totalSize: 0 },
            rasterSceneViews: 0,
            hasPreview: false,
            isPublic: true,
            updatedAt: new Date(),
            createdAt: new Date()
        });

        await this.#storagePlacement.ensurePlacement('trajectory', trajectory.id);

        const expiresAt = new Date(Date.now() + TRAJECTORY_UPLOAD_SESSION_TTL_SECONDS * 1000);
        const sessionFiles = files.map((file, index) => {
            const finalObjectKey = `trajectory-staging/${trajectory.id}/${index}-${safeObjectName(file.name)}`;
            return {
                index,
                originalName: file.name,
                ...(file.type ? { contentType: file.type } : {}),
                size: file.size,
                finalObjectKey,
                parts: buildUploadParts(trajectory.id, index, finalObjectKey, file.size)
            };
        });

        const uploadSession = await TrajectoryUploadSessionModel.create({
            team: teamId,
            user: userId,
            ownerClusterId: storageClusterId,
            bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
            resourceKind: 'trajectory',
            resourceId: trajectory.id,
            files: sessionFiles,
            expiresAt
        });

        await this.#eventBus.publish(new TrajectoryCreatedEvent({
            trajectoryId: trajectory.id,
            trajectoryName: name,
            teamId,
            userId
        }));

        const filesOutput: TrajectoryUploadSessionFileDTO[] = sessionFiles.map((file) => ({
            index: file.index,
            originalName: file.originalName,
            size: file.size,
            ...(file.contentType ? { contentType: file.contentType } : {}),
            finalObjectKey: file.finalObjectKey,
            parts: file.parts.map((part) => {
                const signed = this.#signedUrlService.createToken({
                    kind: 'cluster-object',
                    operation: 'write',
                    teamId,
                    userId,
                    ownerClusterId: storageClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
                    objectKey: part.objectKey,
                    resourceKind: 'trajectory',
                    resourceId: trajectory.id,
                    contentLength: part.size,
                    contentType: file.contentType || 'application/octet-stream',
                    sessionId: String(uploadSession._id),
                    partNumber: part.partNumber
                }, TRAJECTORY_UPLOAD_SESSION_TTL_SECONDS);

                return {
                    partNumber: part.partNumber,
                    offset: part.offset,
                    size: part.size,
                    url: signed.url,
                    expiresAt: signed.expiresAt
                };
            })
        }));

        return {
            trajectory: this.#toTrajectoryOutput(trajectory) as unknown as CreateTrajectoryOutputDTO,
            uploadSession: {
                id: String(uploadSession._id),
                chunkSize: TRAJECTORY_UPLOAD_CHUNK_SIZE,
                expiresAt: expiresAt.toISOString(),
                files: filesOutput
            }
        };
    }

    async commitUploadSession(input: CommitTrajectoryUploadSessionInputDTO): Promise<CommitTrajectoryUploadSessionOutputDTO> {
        const session = await TrajectoryUploadSessionModel.findById(input.uploadSessionId).exec();
        if (!session) {
            throw ApplicationError.notFound('TrajectoryUploadSession::NotFound', 'Upload session not found');
        }

        const trajectoryId = session.resourceId.toString();

        if (session.status === 'committed') {
            return { trajectoryId };
        }

        const validationError = this.#validateUploadSession(session, input);
        if (validationError) {
            throw validationError;
        }

        try {
            const stagedObjects = session.files.map((file) => ({
                objectKey: file.finalObjectKey,
                originalName: file.originalName,
                size: file.size,
                parts: file.parts.map((part) => ({
                    objectKey: part.objectKey,
                    partNumber: part.partNumber,
                    size: part.size
                }))
            }));

            const result = await this.#teamClusterDaemonClient.command<TrajectoryIngestResult>(
                session.ownerClusterId.toString(),
                ChannelCommands.TrajectoryIngest,
                {
                    trajectoryId,
                    teamId: input.teamId,
                    stagedObjects
                },
                { timeoutMs: 0 }
            );

            const trajectory = await TrajectoryModel.findById(trajectoryId);
            const trajectoryName = trajectory?.name || 'Trajectory';
            const frames = await this.#buildPersistableFrames(trajectoryId, input.teamId, result.frames);

            await TrajectoryModel.findByIdAndUpdate(trajectoryId, {
                $set: { status: TrajectoryStatus.Processing, stats: result.stats }
            }).exec();
            await this.#replaceFrames(trajectoryId, frames);

            await this.#daemonAnalysisCompletionService.initializeGlbSession(trajectoryId, frames.length, input.teamId);

            await this.#daemonAnalysisCompletionService.handleQueuedJobs(
                this.#buildQueuedGlbJobs(trajectoryId, trajectoryName, input.teamId, frames),
                'glb',
                session.ownerClusterId.toString()
            ).catch((projectionError) => {
                logger.warn(
                    projectionError,
                    `[TrajectoryService] Failed to project queued GLB jobs for ${trajectoryId}`
                );
            });

            await TrajectoryUploadSessionModel.findByIdAndUpdate(session._id, {
                status: 'committed',
                committedAt: new Date()
            }).exec();

            await this.#eventBus.publish(new TrajectoryUpdatedEvent({
                trajectoryId,
                teamId: input.teamId,
                updates: { status: TrajectoryStatus.Processing, stats: result.stats },
                updatedAt: new Date()
            }));

            return { trajectoryId };
        } catch (error) {
            logger.error(error, `[TrajectoryService] Commit failed for uploadSessionId=${String(session._id)}`);
            await TrajectoryUploadSessionModel.findByIdAndUpdate(session._id, { status: 'failed' }).exec().catch(() => {});
            const trajectory = await TrajectoryModel.findById(trajectoryId).catch(() => null);
            await this.#deleteTrajectoryById(trajectoryId).catch((deleteError) => {
                logger.warn(deleteError, `[TrajectoryService] Failed to delete orphaned trajectory ${trajectoryId}`);
            });
            await this.#eventBus.publish(new TrajectoryDeletedEvent({
                trajectoryId,
                teamId: input.teamId,
                storageClusterId: trajectory ? storageClusterIdOf(trajectory) : undefined,
                userId: input.userId ?? '',
                trajectoryName: trajectory?.name ?? 'Trajectory',
                analysisIds: [],
                analysisComputeClusterIds: []
            })).catch(() => {});

            if (isNoValidFramesError(error)) {
                throw ApplicationError.unprocessableEntity(
                    ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES,
                    'The uploaded file does not contain any readable trajectory frames. Upload a supported trajectory dump (e.g. a LAMMPS dump, XYZ, or a ZIP of frames).'
                );
            }

            throw error;
        }
    }

    async cancelUploadSession(input: CancelTrajectoryUploadSessionInputDTO): Promise<void> {
        const session = await TrajectoryUploadSessionModel.findById(input.uploadSessionId).exec();
        if (!session) {
            throw ApplicationError.notFound('TrajectoryUploadSession::NotFound', 'Upload session not found');
        }

        if (session.team.toString() !== input.teamId || session.user.toString() !== input.userId) {
            throw ApplicationError.forbidden(
                'TrajectoryUploadSession::Forbidden',
                'Upload session does not belong to this user and team'
            );
        }

        if (session.status === 'committed') {
            throw ApplicationError.conflict(
                'TrajectoryUploadSession::AlreadyCommitted',
                'Committed upload sessions cannot be cancelled'
            );
        }

        const ownerClusterId = session.ownerClusterId.toString();
        await Promise.all(session.files.flatMap((file) => [
            this.#objectGatewayClient.deleteObject(ownerClusterId, session.bucket, file.finalObjectKey).catch((error) => {
                logger.debug(error, `[TrajectoryService] Failed to delete ${file.finalObjectKey}`);
            }),
            ...file.parts.map((part) =>
                this.#objectGatewayClient.deleteObject(ownerClusterId, session.bucket, part.objectKey).catch((error) => {
                    logger.debug(error, `[TrajectoryService] Failed to delete ${part.objectKey}`);
                })
            )
        ]));

        await TrajectoryUploadSessionModel.findByIdAndUpdate(session._id, { status: 'cancelled' }).exec();
        await TrajectoryModel.findByIdAndUpdate(session.resourceId, { $set: { status: TrajectoryStatus.Failed } }).exec().catch(() => {});
    }

    async deleteById(input: { trajectoryId: string; teamId?: string; userId?: string }): Promise<{ success: boolean }> {
        const trajectory = await TrajectoryModel.findById(input.trajectoryId);
        if (!trajectory) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        const analysisRuntimeTargets = await this.#analysisRepository.findRuntimeTargetsByTrajectoryId(input.trajectoryId);
        const deleted = await this.#deleteTrajectoryById(input.trajectoryId);
        if (!deleted) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        await this.#eventBus.publish(new TrajectoryDeletedEvent({
            trajectoryId: input.trajectoryId,
            teamId: input.teamId ?? String(trajectory.team) ?? '',
            storageClusterId: storageClusterIdOf(trajectory),
            userId: input.userId ?? '',
            trajectoryName: trajectory.name,
            analysisIds: analysisRuntimeTargets.map((target) => target.analysisId),
            analysisComputeClusterIds: [
                ...new Set(
                    analysisRuntimeTargets
                        .map((target) => target.computeClusterId)
                        .filter((value): value is string => typeof value === 'string' && value.length > 0)
                )
            ]
        }));

        return { success: true };
    }

    async getTeamMetrics(input: GetTeamMetricsInputDTO): Promise<GetTeamMetricsOutputDTO> {
        return this.#teamMetrics.getTeamMetrics(input.teamId);
    }

    async getByTeamId(input: GetTrajectoriesByTeamIdInputDTO): Promise<GetTrajectoriesByTeamIdOutputDTO> {
        const { teamId, page = 1, limit = 20, search } = input;

        const filter: Record<string, unknown> = { team: teamId };
        if (input.folderId === 'root') {
            filter.folder = null;
        } else if (input.folderId) {
            filter.folder = input.folderId;
        }
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const [docs, total] = await Promise.all([
            TrajectoryModel.find(filter)
                .populate([USER_POPULATE, STORAGE_CLUSTER_POPULATE])
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .exec(),
            TrajectoryModel.countDocuments(filter)
        ]);

        const summaries = await this.#getFrameListingSummaries(docs.map((doc) => String(doc._id)));

        const data = docs.map((doc) => {
            const view = this.#toTrajectoryOutput(doc as unknown as TrajectoryDoc) as unknown as TrajectoryPersistedDTO;
            const summary = summaries.get(String(doc._id));
            view.framesCount = summary?.framesCount ?? 0;
            view.atoms = summary?.atoms ?? 0;
            view.firstTimestep = summary?.firstTimestep;
            return view;
        });

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async getById(input: { trajectoryId: string; options?: { populate?: unknown; select?: string[] } }): Promise<GetTrajectoryByIdOutputDTO> {
        const doc = await TrajectoryModel.findById(input.trajectoryId).populate(['team', 'analysis']).exec();
        if (!doc) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        const view = this.#toTrajectoryOutput(doc as unknown as TrajectoryDoc) as unknown as GetTrajectoryByIdOutputDTO;
        (view as unknown as { frames: TrajectoryFrame[] }).frames = await this.#getFrames(String(doc._id));
        return view;
    }

    async updateById(input: UpdateTrajectoryByIdInputDTO): Promise<UpdateTrajectoryByIdOutputDTO> {
        const { trajectoryId, name, isPublic } = input;
        const doc = await TrajectoryModel.findByIdAndUpdate(
            trajectoryId,
            { $set: { name, isPublic } },
            { new: true }
        ).populate(['team', 'analysis']).exec();

        if (!doc) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        return this.#toTrajectoryOutput(doc as unknown as TrajectoryDoc) as unknown as UpdateTrajectoryByIdOutputDTO;
    }

    async move(input: MoveTrajectoryInputDTO): Promise<MoveTrajectoryOutputDTO> {
        try {
            const trajectory = await TrajectoryModel.findOne({ _id: input.trajectoryId, team: input.teamId });
            if (!trajectory) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found');
            }

            if (input.folderId !== null) {
                const folder = await CatalogFolderModel.findOne({ _id: input.folderId, team: input.teamId, kind: CatalogFolderKind.Trajectory });
                if (!folder) {
                    throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target Trajectory folder not found');
                }
            }

            trajectory.folder = input.folderId;
            await trajectory.save();
            return null;
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to move Trajectory', 500);
        }
    }

    async listSamples(): Promise<string[]> {
        try {
            await fs.access(SAMPLES_PATH);
        } catch {
            throw new ApplicationError(ErrorCodes.FILE_NOT_FOUND, 'Sample simulations not found', 404);
        }

        const entries = await fs.readdir(SAMPLES_PATH);
        return entries.filter((entry) => entry.endsWith('.zip'));
    }

    async cloneTrajectory(input: CloneTrajectoryInputDTO): Promise<CloneTrajectoryOutputDTO> {
        try {
            const source = await this.#assertReadable(input.sourceTrajectoryId, input.userId);

            const destinationClusterId = await this.#resolveDestinationStorageClusterId(input.teamId, input.targetClusterId);

            const sourceClusterId = storageClusterIdOf(source);
            if (!sourceClusterId) {
                throw ApplicationError.conflict(
                    'TrajectoryClone::StorageClusterRequired',
                    'Source trajectory does not have a storage cluster assigned'
                );
            }
            const sourceFrames = await this.#getFrames(String(source._id));

            const now = new Date();

            const destinationTrajectory = await this.#createTrajectoryDocument({
                name: source.name,
                team: input.teamId,
                folder: null,
                storageClusterId: destinationClusterId,
                createdBy: input.userId,
                status: TrajectoryStatus.Processing,
                frames: sourceFrames.map((frame) => ({ ...frame })),
                stats: { ...source.stats },
                rasterSceneViews: 0,
                hasPreview: false,
                isPublic: true,
                updatedAt: now,
                createdAt: now
            });

            await this.#storagePlacement.ensurePlacement('trajectory', destinationTrajectory.id);

            const job = await TrajectoryCloneJobModel.create(createTrajectoryCloneJobProps({
                team: input.teamId,
                sourceTrajectoryId: String(source._id),
                destinationTrajectoryId: destinationTrajectory.id,
                sourceClusterId,
                destinationClusterId,
                requestedBy: input.userId,
                stats: { totalFrames: sourceFrames.length }
            }));

            await this.#cloneCoordinator.publishJobProjection(job);

            try {
                this.#cloneRunner.kick(1);
            } catch (error) {
                logger.warn({ err: error }, '[TrajectoryService] Failed to kick clone runner');
            }

            await this.#eventBus.publish(new TrajectoryCreatedEvent({
                trajectoryId: destinationTrajectory.id,
                trajectoryName: destinationTrajectory.name,
                teamId: input.teamId,
                userId: input.userId
            }));

            return {
                trajectoryId: destinationTrajectory.id,
                jobId: job.id,
                sourceTrajectoryId: String(source._id),
                destinationClusterId
            };
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            logger.error({ err: error }, '[TrajectoryService] Unexpected error while cloning trajectory');
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to start trajectory clone', 500);
        }
    }

    async getPreview(input: GetTrajectoryPreviewInputDTO): Promise<GetTrajectoryPreviewOutputDTO> {
        const { trajectoryId } = input;

        const trajectory = await TrajectoryModel.findById(trajectoryId);
        if (!trajectory) {
            throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found', 404);
        }

        const storageClusterId = storageClusterIdOf(trajectory);
        if (!storageClusterId) {
            throw ApplicationError.conflict('Trajectory::StorageClusterRequired', 'Trajectory storage cluster is required');
        }

        const preview = await readTrajectoryPreview({
            trajectoryId,
            storageClusterId,
            objectGatewayClient: this.#objectGatewayClient,
            createOutput: (buffer) => this.#createDashboardPreviewOutput(buffer)
        });
        if (preview) {
            return preview;
        }

        throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'No preview available for this trajectory', 404);
    }

    async downloadTrajectory(input: DownloadTrajectoryInputDTO): Promise<DownloadTrajectoryOutputDTO> {
        const { trajectoryId, archive } = input;

        const trajectory = await TrajectoryModel.findById(trajectoryId);
        if (!trajectory || String(trajectory.team) !== input.teamId) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        const timesteps = await this.#dumpStorage.listDumps(trajectoryId);
        if (timesteps.length === 0) {
            throw ApplicationError.notFound('Trajectory::Dump::NotFound', 'No dump data available for this trajectory');
        }

        const storageClusterId = storageClusterIdOf(trajectory);
        if (!storageClusterId) {
            throw ApplicationError.conflict('Trajectory::StorageClusterRequired', 'Trajectory storage cluster is required');
        }
        const filenameBase = sanitizeDownloadName(input.name || trajectory.name || trajectoryId, 'trajectory');

        if (archive) {
            return this.#createTrajectoryArchiveDownload(input, trajectory.name, storageClusterId, timesteps);
        }

        const firstTimestep = timesteps[0];
        const objectName = buildTrajectoryDumpObjectName(trajectoryId, firstTimestep);

        const response = await this.#objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.DUMPS, objectName);
        return createDownloadStreamResponse({
            stream: response.stream,
            contentType: response.contentType || 'application/octet-stream',
            filename: objectName.split('/').pop() || `${filenameBase}.dump.zst`,
            cacheControl: 'no-cache'
        });
    }

    async downloadTrajectoryAnalyses(input: DownloadTrajectoryAnalysesInputDTO): Promise<DownloadTrajectoryAnalysesOutputDTO> {
        const trajectory = await TrajectoryModel.findById(input.trajectoryId);
        if (!trajectory || String(trajectory.team) !== input.teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        const analyses = await this.#analysisRepository.findAll({
            filter: { trajectory: input.trajectoryId, team: input.teamId },
            sort: { createdAt: -1 },
            limit: 1000
        });

        const completedAnalyses = analyses.data.filter((analysis) => (
            String(analysis.props.status || '').toLowerCase() === ANALYSIS_STATUS_COMPLETED
        ));

        if (completedAnalyses.length === 0) {
            throw ApplicationError.conflict(
                'Trajectory::Analyses::NoCompletedExports',
                'No completed analyses are available to download for this trajectory'
            );
        }

        const filenameBase = sanitizeDownloadName(input.name || trajectory.name || input.trajectoryId, 'trajectory');
        const storageClusterId = storageClusterIdOf(trajectory);
        if (!storageClusterId) {
            throw ApplicationError.conflict('Trajectory::StorageClusterRequired', 'Trajectory storage cluster is required');
        }

        const limit = pLimit(ANALYSIS_EXPORT_CONCURRENCY);
        const archiveEntries = (await Promise.all(completedAnalyses.map((analysis) => (
            limit(() => this.#buildAnalysisArchiveEntry(analysis, input.teamId))
        )))).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

        if (archiveEntries.length === 0) {
            throw ApplicationError.conflict(
                'Trajectory::Analyses::NoTimestepArtifacts',
                'No completed analysis artifacts are available to download for this trajectory'
            );
        }

        return this.#archiveService.createArchiveDownload({
            teamClusterId: storageClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/trajectory-analyses/${input.trajectoryId}/${v4()}.zip`,
            filename: `${filenameBase}-analyses.zip`,
            entries: archiveEntries
        });
    }

    async downloadSamples(input: DownloadSampleSimulationsInputDTO): Promise<DownloadSampleSimulationsOutputDTO> {
        const { filename } = input;

        if (!filename || !filename.endsWith('.zip')) {
            throw new ApplicationError(ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid filename', 400);
        }

        const filePath = path.join(SAMPLES_PATH, filename);

        try {
            await access(filePath);
        } catch {
            throw new ApplicationError(ErrorCodes.FILE_NOT_FOUND, 'Sample not found', 404);
        }

        return { stream: createReadStream(filePath), filename };
    }

    async getAtoms(input: GetAtomsColumnarInputDTO): Promise<GetAtomsColumnarOutputDTO> {
        try {
            const { trajectoryId, timestep } = input;
            const analysisId = normalizeAnalysisId(input.analysisId);
            const page = Math.max(1, input.page ?? 1);
            const limitNum = Math.min(5_000_000, Math.max(1, input.limit ?? 5_000_000));

            const trajectory = await TrajectoryModel.findById(trajectoryId);
            if (!trajectory) {
                throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
            }

            const ownerClusterId = storageClusterIdOf(trajectory);
            let teamClusterId: string | undefined;
            if (analysisId) {
                const analysis = await this.#analysisRepository.findById(analysisId);
                if (!analysis) {
                    throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
                }
                if (analysis.props.trajectory !== trajectoryId) {
                    throw ApplicationError.badRequest(
                        ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                        'Analysis does not belong to the requested trajectory'
                    );
                }
                teamClusterId = resolveAnalysisComputeClusterId(analysis.props) ?? teamClusterId;
            } else if (ownerClusterId) {
                teamClusterId = await this.#clusterSelection.resolveComputeClusterId(String(trajectory.team), undefined, ownerClusterId);
            }

            if (!teamClusterId) {
                throw ApplicationError.notFound(
                    ErrorCodes.TRAJECTORY_TEAM_CLUSTER_REQUIRED,
                    'Trajectory storage or compute cluster is required to retrieve atoms'
                );
            }

            const atomsPage = await this.#reader.readPage(
                teamClusterId,
                trajectoryId,
                timestep,
                page,
                limitNum,
                analysisId,
                ownerClusterId
            );

            return this.#toAtomsColumnarOutput(atomsPage, page, limitNum);
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw ApplicationError.internalServerError('Failed to retrieve trajectory atoms');
        }
    }


    async listFolders(teamId: string, query: TrajectoryFolderQuery): Promise<PaginatedResult<TrajectoryFolderView>> {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 500;
        const filter = { team: teamId, kind: CatalogFolderKind.Trajectory, parent: query.parentId ?? null };

        const [docs, total] = await Promise.all([
            CatalogFolderModel.find(filter).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }).exec(),
            CatalogFolderModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => this.#presentFolder(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async getFolder(teamId: string, folderId: string): Promise<TrajectoryFolderView> {
        const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Trajectory });
        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory folder not found');
        }
        return this.#presentFolder(folder);
    }

    async createFolder(teamId: string, userId: string, input: { title: string; parentId?: string | null }): Promise<TrajectoryFolderView> {
        const folder = new CatalogFolderModel({
            team: new mongoose.Types.ObjectId(teamId),
            createdBy: new mongoose.Types.ObjectId(userId),
            title: input.title,
            parent: input.parentId ? new mongoose.Types.ObjectId(input.parentId) : null,
            kind: CatalogFolderKind.Trajectory
        });
        await folder.save();
        return this.#presentFolder(folder);
    }

    async updateFolder(teamId: string, folderId: string, input: { title: string }): Promise<TrajectoryFolderView> {
        const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Trajectory });
        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory folder not found');
        }
        folder.title = input.title;
        await folder.save();
        return this.#presentFolder(folder);
    }

    async deleteFolder(teamId: string, folderId: string): Promise<null> {
        try {
            const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Trajectory });
            if (!folder) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory folder not found');
            }

            await this.#deleteFolderTree(teamId, folderId);
            return null;
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete Trajectory folder', 500);
        }
    }


    async getSceneArtifacts(input: ListTrajectorySceneArtifactsInputDTO): Promise<PaginatedResult<unknown>> {
        return this.#listTrajectorySceneArtifacts(input);
    }

    async listTeamSceneArtifacts(input: ListTeamSceneArtifactsInputDTO): Promise<ListTeamSceneArtifactsOutputDTO> {
        const page = input.page ?? 1;
        const limit = input.limit ?? 100;
        const skip = (page - 1) * limit;

        const pipeline: PipelineStage[] = [];
        const match: Record<string, unknown> = {};
        if (input.sourceType) match.sourceType = input.sourceType;
        if (input.analysisId) match.analysis = new mongoose.Types.ObjectId(input.analysisId);
        if (input.timestep !== undefined) match.timestep = input.timestep;
        if (Object.keys(match).length > 0) {
            pipeline.push({ $match: match });
        }
        pipeline.push(
            { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
            { $unwind: '$trajectoryDoc' },
            { $match: { 'trajectoryDoc.team': new mongoose.Types.ObjectId(input.teamId) } }
        );

        const [idRows, countRows] = await Promise.all([
            SceneArtifactModel.aggregate<{ _id: mongoose.Types.ObjectId }>([
                ...pipeline,
                { $sort: { updatedAt: -1, _id: -1 } },
                { $skip: skip },
                { $limit: limit },
                { $project: { _id: 1 } }
            ]),
            SceneArtifactModel.aggregate<{ total: number }>([...pipeline, { $count: 'total' }])
        ]);

        const ids = idRows.map((row) => row._id);
        const total = countRows[0]?.total ?? 0;

        if (!ids.length) {
            return { data: [], total: 0, page, totalPages: 0, limit };
        }

        const docs = await SceneArtifactModel.find({ _id: { $in: ids } }).populate([
            { path: 'trajectory', select: ['name', 'storageClusterId'], populate: STORAGE_CLUSTER_POPULATE },
            STORAGE_CLUSTER_POPULATE
        ]).exec();

        const orderById = new Map(ids.map((id, index) => [id.toString(), index]));
        const sortedDocs = docs.sort((left, right) => (
            (orderById.get(left._id.toString()) ?? 0) - (orderById.get(right._id.toString()) ?? 0)
        ));

        return {
            data: sortedDocs.map((doc) => this.#toSceneArtifactOutput(doc) as unknown as TeamSceneArtifactOutput),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }


    async getColorCodingProperties(input: GetColorCodingPropertiesInputDTO): Promise<GetColorCodingPropertiesOutputDTO> {
        return this.#runService(() => this.#colorCoding.getProperties(input.trajectoryId, input.timestep, input.analysisId));
    }

    async getColorCodingStats(input: GetColorCodingStatsInputDTO): Promise<GetColorCodingStatsOutputDTO> {
        return this.#runService(() => this.#colorCoding.getStats(
            input.trajectoryId,
            input.timestep,
            input.property,
            input.type,
            input.analysisId,
            input.exposureId
        ));
    }

    async createColoredModel(input: CreateColoredModelInputDTO): Promise<CreateColoredModelOutputDTO> {
        await this.#colorCoding.createColoredModel(
            input.trajectoryId,
            input.timestep,
            input.property,
            input.startValue,
            input.endValue,
            input.gradient,
            input.analysisId,
            input.exposureId
        );
        return null;
    }

    async getColoredModelStream(input: GetColoredModelStreamInputDTO): Promise<GetColoredModelStreamOutputDTO & StreamableOutput> {
        const response = await this.#colorCoding.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.property,
            input.startValue,
            input.endValue,
            input.gradient,
            input.analysisId,
            input.exposureId
        );
        return response as GetColoredModelStreamOutputDTO & StreamableOutput;
    }


    async getParticleFilterProperties(input: GetParticleFilterPropertiesInputDTO): Promise<GetParticleFilterPropertiesOutputDTO> {
        return this.#runService(() => this.#particleFilter.getProperties(input.trajectoryId, input.timestep, input.analysisId));
    }

    async previewParticleFilter(input: PreviewParticleFilterInputDTO): Promise<PreviewParticleFilterOutputDTO> {
        return this.#particleFilter.preview(
            input.trajectoryId,
            input.timestep,
            buildParticleFilterRequest(input),
            input.analysisId
        );
    }

    async applyParticleFilterAction(input: ApplyParticleFilterActionInputDTO): Promise<ApplyParticleFilterActionOutputDTO> {
        return this.#particleFilter.applyAction(
            input.trajectoryId,
            input.timestep,
            input.action,
            buildParticleFilterRequest(input),
            input.analysisId
        );
    }

    async getFilteredModelStream(input: GetFilteredModelStreamInputDTO): Promise<GetFilteredModelStreamOutputDTO & StreamableOutput> {
        const response = await this.#particleFilter.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            buildParticleFilterRequest(input),
            input.action,
            input.analysisId
        );
        return response as GetFilteredModelStreamOutputDTO & StreamableOutput;
    }

    async getParticleFilterUniqueValues(input: GetParticleFilterUniqueValuesInputDTO): Promise<GetParticleFilterUniqueValuesOutputDTO> {
        return this.#runService(async () => {
            const values = await this.#particleFilter.getUniqueValues(
                input.trajectoryId,
                input.timestep,
                input.property,
                input.maxValues,
                input.analysisId,
                input.exposureId
            );
            return { values };
        });
    }


    async createLineStyledModel(input: CreateLineStyledModelInputDTO): Promise<CreateLineStyledModelOutputDTO> {
        return this.#lineStyle.createStyledModel(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            input.style ?? {}
        );
    }

    async getLineStyledModelStream(input: GetLineStyledModelStreamInputDTO): Promise<GetLineStyledModelStreamOutputDTO & StreamableOutput> {
        const response = await this.#lineStyle.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            parseLineStyle(input.style)
        );
        return response as GetLineStyledModelStreamOutputDTO & StreamableOutput;
    }

    async getLineModelRangesStream(input: GetLineModelRangesStreamInputDTO): Promise<StreamableOutput> {
        const response = await this.#lineStyle.getRangesStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            input.style ? parseLineStyle(input.style) : undefined
        );
        return response as StreamableOutput;
    }

    async getLineEntityProperties(input: GetLineEntityPropertiesInputDTO): Promise<GetLineEntityPropertiesOutputDTO> {
        const entityId = Number(input.entityId);
        if (!Number.isInteger(entityId) || entityId < 0) {
            throw ApplicationError.badRequest('LINE_ENTITY_ID_INVALID', 'The entity id must be a non-negative integer.');
        }

        const index = await this.#atomProperties.buildPluginIndexForAtomIds(
            input.trajectoryId,
            input.analysisId,
            input.exposureId,
            input.timestep,
            new Set([entityId])
        );

        const properties = index?.get(entityId);
        if (!properties) {
            throw ApplicationError.notFound(
                'LINE_ENTITY_NOT_FOUND',
                `No entity ${entityId} found for exposure "${input.exposureId}" at timestep ${input.timestep}`
            );
        }

        return { entityId, properties };
    }


    async getOctreeMetadataStream(input: GetOctreeMetadataStreamInputDTO): Promise<StreamableOutput> {
        const response = await this.#lineStyle.getOctreeMetadataStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId
        );
        return response as StreamableOutput;
    }


    async listPublicTeamTrajectories(input: ListPublicTeamTrajectoriesInputDTO): Promise<ListPublicTeamTrajectoriesOutputDTO> {
        const { teamId, page = 1, limit = 20 } = input;
        const team = await this.#teamRepository.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        const filter: Record<string, unknown> = { team: teamId, isPublic: true };
        const search = input.search?.trim();
        if (search) {
            filter.name = { $regex: escapeRegex(search), $options: 'i' };
        }

        const [docs, total] = await Promise.all([
            TrajectoryModel.find(filter)
                .select(['name', 'team', 'status', 'isPublic', 'hasPreview', 'stats', 'createdAt', 'updatedAt'])
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .exec(),
            TrajectoryModel.countDocuments(filter)
        ]);

        const summaries = await this.#getFrameListingSummaries(docs.map((doc) => String(doc._id)));

        const data = docs.map((doc) => {
            const view = this.#toTrajectoryOutput(doc as unknown as TrajectoryDoc) as unknown as TrajectoryPersistedDTO;
            const summary = summaries.get(String(doc._id));
            view.framesCount = summary?.framesCount ?? 0;
            view.atoms = summary?.atoms ?? 0;
            view.firstTimestep = summary?.firstTimestep;
            return view;
        });

        const teamDiscovery: PublicTeamDiscoveryDTO = { _id: team.id, name: team.props.name };

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit,
            _meta: { team: teamDiscovery }
        };
    }


    async getPublicCanvasBootstrap(input: GetPublicCanvasBootstrapInputDTO): Promise<GetPublicCanvasBootstrapOutputDTO> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);

        let hasTeamMembership = false;
        if (input.userId) {
            const membership = await this.#teamMemberRepository.findOne({
                team: String(trajectory.team),
                user: input.userId
            });
            hasTeamMembership = membership !== null;
        }

        const frames = await this.#getFrames(String(trajectory._id));

        return {
            access: {
                mode: PublicCanvasAccessMode.ReadOnly,
                isGuest: !input.userId,
                isPublic: trajectory.isPublic,
                hasTeamMembership
            },
            trajectory: this.#toBootstrapTrajectory(trajectory, frames)
        };
    }

    async getPublicCanvasTrajectory(input: { trajectoryId: string; userId?: string }): Promise<GetTrajectoryByIdOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        return this.getById({ trajectoryId: input.trajectoryId });
    }

    async getPublicCanvasPreview(input: { trajectoryId: string; userId?: string }): Promise<GetTrajectoryPreviewOutputDTO> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);

        const storageClusterId = storageClusterIdOf(trajectory);
        if (!storageClusterId) {
            throw ApplicationError.conflict('Trajectory::StorageClusterRequired', 'Trajectory storage cluster is required');
        }

        const preview = await readTrajectoryPreview({
            trajectoryId: input.trajectoryId,
            storageClusterId,
            objectGatewayClient: this.#objectGatewayClient,
            createOutput: (buffer) => this.#createCanvasPreviewOutput(buffer)
        });
        if (preview) {
            return preview;
        }

        throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'No preview available for this trajectory', 404);
    }

    async getPublicCanvasRasterFrame(input: GetPublicCanvasRasterFrameInputDTO): Promise<GetPublicCanvasRasterFrameOutputDTO> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);
        return new RasterService().getRasterFramePNG({
            trajectoryId: input.trajectoryId,
            teamId: String(trajectory.team),
            timestep: input.timestep,
            analysisId: input.analysisId,
            model: input.model
        });
    }

    async getPublicCanvasDump(input: { trajectoryId: string; timestep: string; userId?: string }): Promise<DownloadStreamOutputDTO> {
        try {
            await this.#assertReadable(input.trajectoryId, input.userId);

            const response = await this.#dumpStorage.getDumpResponse(input.trajectoryId, input.timestep);
            const extraHeaders: Record<string, string> = {};
            if (response.contentEncoding) {
                extraHeaders['X-Volt-Resource-Encoding'] = response.contentEncoding;
            }

            return createDownloadStreamResponse({
                stream: response.stream,
                contentType: 'application/octet-stream',
                filename: response.contentEncoding === 'zstd'
                    ? `timestep-${input.timestep}.dump.zst`
                    : `timestep-${input.timestep}.dump`,
                disposition: 'inline',
                contentLength: response.contentLength,
                extraHeaders,
                cacheControl: 'public, max-age=31536000, immutable'
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory dump not found', 404);
        }
    }

    async getPublicCanvasGLB(input: GetPublicCanvasGLBInputDTO): Promise<GetPublicCanvasGLBOutputDTO> {
        try {
            const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);
            const storageClusterId = storageClusterIdOf(trajectory);
            if (!storageClusterId) {
                throw ApplicationError.conflict('Trajectory::StorageClusterRequired', 'Trajectory storage cluster is required');
            }
            const objectName = buildTrajectoryGlbObjectName(input.trajectoryId, input.timestep);
            return await getClusterGlbStream(this.#objectGatewayClient, storageClusterId, objectName, { acceptEncoding: input.acceptEncoding });
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'GLB model not found', 404);
        }
    }

    async listPublicCanvasAnalyses(input: { trajectoryId: string; userId?: string; page?: number; limit?: number }): Promise<GetAnalysesByTrajectoryIdOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);

        const analyses = await this.#analysisRepository.findAll({
            filter: { trajectory: input.trajectoryId },
            populate: [TRAJECTORY_POPULATE, { path: 'plugin' }],
            page: input.page,
            limit: input.limit,
            sort: { createdAt: -1 }
        });

        const data = analyses.data.map((analysis) => {
            const props = { ...analysis.props };
            const pluginId = extractPluginId(props.plugin);
            return { ...props, _id: analysis._id, plugin: pluginId };
        });

        return { ...analyses, data } as unknown as GetAnalysesByTrajectoryIdOutputDTO;
    }

    async getPublicCanvasSimulationCell(input: { trajectoryId: string; timestep?: number; userId?: string }): Promise<GetSimulationCellByTrajectoryOutputDTO> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);
        return new SimulationCellService().getByTrajectory({
            teamId: String(trajectory.team),
            trajectoryId: input.trajectoryId,
            timestep: input.timestep
        });
    }

    async listPublicCanvasSceneArtifacts(input: ListTrajectorySceneArtifactsInputDTO & { userId?: string }): Promise<PaginatedResult<unknown>> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.#listTrajectorySceneArtifacts(delegated);
    }

    async getPublicCanvasColorCodingProperties(input: GetColorCodingPropertiesInputDTO & { userId?: string }): Promise<GetColorCodingPropertiesOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getColorCodingProperties(delegated);
    }

    async getPublicCanvasColorCodingStats(input: GetColorCodingStatsInputDTO & { userId?: string }): Promise<GetColorCodingStatsOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getColorCodingStats(delegated);
    }

    async getPublicCanvasColoredModelStream(input: GetColoredModelStreamInputDTO & { userId?: string }): Promise<StreamableOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getColoredModelStream(delegated);
    }

    async getPublicCanvasParticleFilterProperties(input: GetParticleFilterPropertiesInputDTO & { userId?: string }): Promise<GetParticleFilterPropertiesOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getParticleFilterProperties(delegated);
    }

    async getPublicCanvasParticleFilterUniqueValues(input: GetParticleFilterUniqueValuesInputDTO & { userId?: string }): Promise<GetParticleFilterUniqueValuesOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getParticleFilterUniqueValues(delegated);
    }

    async getPublicCanvasParticleFilterPreview(input: PreviewParticleFilterInputDTO & { userId?: string }): Promise<PreviewParticleFilterOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.previewParticleFilter(delegated);
    }

    async getPublicCanvasFilteredModelStream(input: GetFilteredModelStreamInputDTO & { userId?: string }): Promise<StreamableOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getFilteredModelStream(delegated);
    }

    async getPublicCanvasPlugin(input: { trajectoryId: string; pluginId: string; userId?: string }): Promise<GetPluginByIdOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);

        const analyses = await this.#analysisRepository.findAll({ filter: { trajectory: input.trajectoryId }, limit: 1000 });
        const pluginAttached = analyses.data.some((analysis) => extractPluginId(analysis.props.plugin) === input.pluginId);

        if (!pluginAttached) {
            throw ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found');
        }

        return this.#pluginService.getPluginById({ pluginId: input.pluginId });
    }

    async getPublicCanvasPluginListing(input: {
        trajectoryId: string;
        pluginId: string;
        exposureName?: string;
        exposureId?: string;
        analysisId?: string;
        page?: number;
        limit?: number;
        sortAsc?: boolean;
        userId?: string;
    }): Promise<GetPluginListingDocumentsOutputDTO> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);
        const teamId = String(trajectory.team);

        if (input.analysisId) {
            const analysis = await this.#analysisRepository.findById(input.analysisId);
            if (!analysis) {
                throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
            }
            if (String(analysis.props.trajectory) !== input.trajectoryId) {
                throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH, 'Analysis does not belong to the requested trajectory');
            }
            if (extractPluginId(analysis.props.plugin) !== input.pluginId) {
                throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH, 'Analysis does not belong to the requested plugin');
            }
        }

        return this.#pluginService.getPluginListingDocuments({
            pluginId: input.pluginId,
            exposureName: input.exposureName,
            exposureId: input.exposureId,
            teamId,
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            page: input.page,
            limit: input.limit,
            sortAsc: input.sortAsc
        });
    }

    async getPublicCanvasSubListing(input: {
        trajectoryId: string;
        analysisId: string;
        exposureId: string;
        timestep: number;
        subListingName: string;
        page?: number;
        limit?: number;
        userId?: string;
    }): Promise<GetSubListingOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);

        const analysis = await this.#analysisRepository.findById(input.analysisId);
        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }
        if (String(analysis.props.trajectory) !== input.trajectoryId) {
            throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH, 'Analysis does not belong to the requested trajectory');
        }

        return this.#pluginService.getSubListing({
            analysisId: input.analysisId,
            exposureId: input.exposureId,
            timestep: input.timestep,
            subListingName: input.subListingName,
            teamId: String(analysis.props.team),
            page: input.page,
            limit: input.limit
        });
    }

    async getPublicCanvasPluginExposureGLB(input: {
        trajectoryId: string;
        analysisId: string;
        exposureId: string;
        timestep: string;
        userId?: string;
        acceptEncoding?: string;
    }): Promise<GetPluginExposureGLBOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);

        const analysis = await this.#analysisRepository.findById(input.analysisId);
        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }
        if (String(analysis.props.trajectory) !== input.trajectoryId) {
            throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH, 'Analysis does not belong to the requested trajectory');
        }

        return this.#pluginService.getPluginExposureGLB({
            teamId: String(analysis.props.team),
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            exposureId: input.exposureId,
            timestep: input.timestep,
            acceptEncoding: input.acceptEncoding
        });
    }

    async getPublicCanvasAnalysisFrameLog(input: {
        trajectoryId: string;
        analysisId: string;
        timestep: number;
        afterCursor?: string;
        userId?: string;
    }): Promise<GetAnalysisFrameLogOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);

        const analysis = await this.#analysisRepository.findById(input.analysisId);
        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }
        if (String(analysis.props.trajectory) !== input.trajectoryId) {
            throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH, 'Analysis does not belong to the requested trajectory');
        }

        return analysisExecutionLogService.getFrameLog({
            teamId: String(analysis.props.team),
            analysisId: input.analysisId,
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            afterCursor: input.afterCursor
        });
    }

    async getPublicCanvasRasterMetadata(input: { trajectoryId: string; userId?: string }): Promise<GetRasterMetadataOutputDTO> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);
        return new RasterService().getRasterMetadata({ trajectoryId: input.trajectoryId, teamId: String(trajectory.team) });
    }

    async getPublicCanvasAtoms(input: { trajectoryId: string; analysisId?: string; timestep: number; page?: number; limit?: number; userId?: string }): Promise<GetAtomsColumnarOutputDTO> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        return this.getAtoms({
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            timestep: input.timestep,
            page: input.page,
            limit: input.limit
        });
    }


    async #assertReadable(trajectoryId: string, userId?: string): Promise<TrajectoryDoc> {
        const trajectory = await TrajectoryModel.findById(trajectoryId) as unknown as TrajectoryDoc | null;

        if (!trajectory) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        if (trajectory.isPublic) {
            return trajectory;
        }

        if (!userId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 'Team membership required to access this trajectory');
        }

        const membership = await this.#teamMemberRepository.findOne({ team: String(trajectory.team), user: userId });
        if (!membership) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 'Team membership required to access this trajectory');
        }

        return trajectory;
    }

    async #runService<TOutput>(executor: () => Promise<TOutput>): Promise<TOutput> {
        try {
            return await executor();
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw ApplicationError.internalServerError('Failed to process trajectory service request');
        }
    }

    async #createTrajectoryDocument(data: {
        name: string;
        team: string;
        folder: string | null;
        storageClusterId?: string;
        createdBy: string;
        status: TrajectoryStatus;
        frames?: TrajectoryFrame[];
        stats: { totalFiles: number; totalSize: number };
        rasterSceneViews: number;
        hasPreview: boolean;
        isPublic: boolean;
        updatedAt: Date;
        createdAt: Date;
    }): Promise<TrajectoryDoc> {
        const { frames, ...rest } = data;
        const doc = new TrajectoryModel(rest) as unknown as TrajectoryDoc;
        await doc.save();

        if (frames && frames.length > 0) {
            await this.#replaceFrames(String(doc._id), frames);
        }

        return doc;
    }

    async #deleteTrajectoryById(id: string): Promise<boolean> {
        const result = await TrajectoryModel.findByIdAndDelete(id);
        if (result) {
            await TrajectoryFrameModel.deleteMany({ trajectoryId: new mongoose.Types.ObjectId(id) }).exec().catch(() => undefined);
        }
        return !!result;
    }

    #toTrajectoryOutput(doc: TrajectoryDoc): Record<string, unknown> {
        return { ...doc.toObject(), _id: String(doc._id) };
    }

    #toBootstrapTrajectory(trajectory: TrajectoryDoc, frames: TrajectoryFrame[]): PublicCanvasBootstrapTrajectoryDTO {
        return {
            _id: String(trajectory._id),
            name: trajectory.name,
            status: trajectory.status,
            isPublic: trajectory.isPublic,
            teamId: String(trajectory.team),
            analysisIds: trajectory.analysis ?? [],
            frames: frames.map((frame) => ({
                timestep: frame.timestep,
                natoms: frame.natoms,
                simulationCell: (typeof frame.simulationCell === 'string'
                    ? frame.simulationCell
                    : frame.simulationCell?._id) ?? ''
            }))
        };
    }

    async #createDashboardPreviewOutput(buffer: Buffer): Promise<GetTrajectoryPreviewOutputDTO> {
        const resized = await sharp(buffer)
            .resize(DASHBOARD_PREVIEW_MAX_WIDTH, DASHBOARD_PREVIEW_MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
            .png({ compressionLevel: 9 })
            .toBuffer();

        const etag = `"${createHash('sha256').update(resized).digest('hex')}"`;
        return { base64: `data:image/png;base64,${resized.toString('base64')}`, etag };
    }

    #createCanvasPreviewOutput(buffer: Buffer): GetTrajectoryPreviewOutputDTO {
        const etag = `"${createHash('sha256').update(buffer).digest('hex')}"`;
        return { base64: `data:image/png;base64,${buffer.toString('base64')}`, etag };
    }

    async #resolveDestinationStorageClusterId(teamId: string, requestedClusterId?: string): Promise<string> {
        if (!requestedClusterId) {
            return this.#clusterSelection.resolveStorageClusterId(teamId);
        }

        const requestedCluster = await this.#teamClusterRepository.findById(requestedClusterId);
        if (!requestedCluster || requestedCluster.props.team !== teamId) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found for the requested team');
        }

        if (requestedCluster.props.status !== TeamClusterStatus.Connected) {
            throw ApplicationError.conflict(
                'TeamCluster::StorageClusterRequired',
                'A connected storage-capable team cluster is required for this operation'
            );
        }

        const requestedCapabilities = resolveEffectiveCapabilitiesFromRoleConfig(requestedCluster.props.roleConfig);
        if (requestedCapabilities.acceptsStorageWrites) {
            return requestedCluster.id;
        }

        return this.#clusterSelection.resolveStorageClusterId(teamId, undefined, requestedCluster.id);
    }

    #validateUploadSession(
        session: { status: string; expiresAt: Date; team: mongoose.Types.ObjectId; user: mongoose.Types.ObjectId; resourceKind: string },
        input: CommitTrajectoryUploadSessionInputDTO
    ): ApplicationError | null {
        if (session.status !== 'pending') {
            return ApplicationError.conflict('TrajectoryUploadSession::NotPending', 'Upload session is not pending');
        }
        if (session.expiresAt.getTime() <= Date.now()) {
            return ApplicationError.badRequest('TrajectoryUploadSession::Expired', 'Upload session has expired');
        }
        if (session.team.toString() !== input.teamId || session.user.toString() !== input.userId) {
            return ApplicationError.forbidden('TrajectoryUploadSession::Forbidden', 'Upload session does not belong to this user and team');
        }
        if (session.resourceKind !== 'trajectory') {
            return ApplicationError.badRequest('TrajectoryUploadSession::UnsupportedResource', 'Upload session is not a trajectory upload');
        }
        return null;
    }

    async #buildPersistableFrames(trajectoryId: string, teamId: string, frames: TrajectoryIngestResult['frames']): Promise<TrajectoryFrame[]> {
        const cellItems = frames
            .filter((frame) => frame.simulationCell)
            .map((frame) => ({
                ...frame.simulationCell!,
                team: teamId,
                trajectory: trajectoryId,
                timestep: frame.timestep
            }));

        const cells = cellItems.length > 0 ? await this.#simulationCellRepository.createMany(cellItems as never) : [];

        let cellIndex = 0;
        return frames.map((frame) => ({
            timestep: frame.timestep,
            natoms: frame.natoms,
            simulationCell: frame.simulationCell ? (cells[cellIndex++] as unknown as { _id: string })._id : undefined
        }));
    }

    #buildQueuedGlbJobs(trajectoryId: string, trajectoryName: string, teamId: string, frames: TrajectoryFrame[]): QueuedGlbJob[] {
        return frames.map((frame) => ({
            jobId: `trajectory-glb:${trajectoryId}:${frame.timestep}`,
            teamId,
            queueType: GLB_QUEUE_TYPE,
            name: GLB_JOB_NAME,
            trajectoryId,
            trajectoryName,
            timestep: frame.timestep
        }));
    }

    async #createTrajectoryArchiveDownload(
        input: DownloadTrajectoryInputDTO,
        trajectoryName: string | undefined,
        teamClusterId: string,
        timesteps: string[]
    ): Promise<DownloadTrajectoryOutputDTO> {
        const filenameBase = sanitizeDownloadName(input.name || trajectoryName || input.trajectoryId, 'trajectory');

        return this.#archiveService.createArchiveDownload({
            teamClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/trajectory-downloads/${input.trajectoryId}/${v4()}.zip`,
            filename: `${filenameBase}-dumps.zip`,
            cacheControl: 'no-cache',
            entries: timesteps.map((timestep) => {
                const objectName = buildTrajectoryDumpObjectName(input.trajectoryId, timestep);
                return {
                    type: 'object' as const,
                    ownerClusterId: teamClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
                    objectKey: objectName,
                    name: objectName.split('/').pop() || objectName
                };
            })
        });
    }

    async #buildAnalysisArchiveEntry(analysis: Analysis, teamId: string): Promise<ClusterArchiveObjectEntry | null> {
        let exportArtifact: DownloadStreamOutputDTO;

        try {
            exportArtifact = await this.#pluginService.getPluginExposureExport({ analysisId: analysis._id, teamId });
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return null;
            }
            throw error;
        }

        await exportArtifact.prepare?.();

        const candidate = exportArtifact as DownloadStreamOutputDTO & { clusterObject?: ClusterArchiveReference };
        const clusterObject = candidate.clusterObject ?? null;
        exportArtifact.stream.destroy();
        if (!clusterObject) {
            return null;
        }

        const filename = readFilenameFromContentDisposition(exportArtifact.headers['Content-Disposition'])
            || readFilenameFromContentDisposition(exportArtifact.headers['content-disposition'])
            || `AnalysisID-${analysis._id}.zip`;

        return {
            type: 'object' as const,
            ownerClusterId: clusterObject.teamClusterId,
            bucket: clusterObject.bucket,
            objectKey: clusterObject.objectKey,
            name: filename
        };
    }

    #toAtomsColumnarOutput(
        atomsPage: Awaited<ReturnType<typeof trajectoryReader.readPage>>,
        page: number,
        limitNum: number
    ): GetAtomsColumnarOutputDTO {
        const ID_PROPERTY_NAME = 'id';
        const TYPE_PROPERTY_NAME = 'type';
        const POSITION_PROPERTY_NAMES = ['x', 'y', 'z'] as const;

        const nativeProperties = atomsPage.nativeProperties ?? [];
        const analysisPropertyNames = atomsPage.analysisPropertyNames ?? [];
        const allProps = [...nativeProperties, ...analysisPropertyNames];

        let perAtomData: Map<number, Record<string, unknown>> | null = null;
        if (atomsPage.analysisAtoms && atomsPage.analysisAtoms.length > 0) {
            perAtomData = new Map();
            for (const item of atomsPage.analysisAtoms) {
                if (item?.id === undefined) continue;
                perAtomData.set(Number(item.id), item);
            }
        }

        const rowCount = atomsPage.atoms.length;
        const idBuffer = new ArrayBuffer(rowCount * Uint32Array.BYTES_PER_ELEMENT);
        const typeBuffer = new ArrayBuffer(rowCount * Uint32Array.BYTES_PER_ELEMENT);
        const xBuffer = new ArrayBuffer(rowCount * Float32Array.BYTES_PER_ELEMENT);
        const yBuffer = new ArrayBuffer(rowCount * Float32Array.BYTES_PER_ELEMENT);
        const zBuffer = new ArrayBuffer(rowCount * Float32Array.BYTES_PER_ELEMENT);
        const ids = new Uint32Array(idBuffer);
        const types = new Uint32Array(typeBuffer);
        const xs = new Float32Array(xBuffer);
        const ys = new Float32Array(yBuffer);
        const zs = new Float32Array(zBuffer);
        const extraColumns = new Map<string, unknown[]>();

        for (const prop of allProps) {
            if (prop === ID_PROPERTY_NAME
                || prop === TYPE_PROPERTY_NAME
                || POSITION_PROPERTY_NAMES.includes(prop as (typeof POSITION_PROPERTY_NAMES)[number])) {
                continue;
            }
            extraColumns.set(prop, new Array<unknown>(rowCount));
        }

        for (let row = 0; row < rowCount; row += 1) {
            const atom = atomsPage.atoms[row];
            const atomId = Number(atom.id);
            ids[row] = atomId;
            types[row] = Number(atom.type);
            xs[row] = Number(atom.x);
            ys[row] = Number(atom.y);
            zs[row] = Number(atom.z);

            for (const [prop, column] of extraColumns) {
                const nativeValue = atom[prop];
                column[row] = typeof nativeValue === 'number'
                    ? nativeValue
                    : perAtomData?.get(atomId)?.[prop] ?? nativeValue;
            }
        }

        const columns: AtomColumn[] = [
            { name: ID_PROPERTY_NAME, dtype: 'u32', buffer: new Uint8Array(idBuffer) },
            { name: TYPE_PROPERTY_NAME, dtype: 'u32', buffer: new Uint8Array(typeBuffer) },
            { name: 'x', dtype: 'f32', buffer: new Uint8Array(xBuffer) },
            { name: 'y', dtype: 'f32', buffer: new Uint8Array(yBuffer) },
            { name: 'z', dtype: 'f32', buffer: new Uint8Array(zBuffer) }
        ];

        const stringColumns: AtomColumn[] = [];
        for (const [prop, values] of extraColumns) {
            if (values.some((value) => typeof value === 'string' && !Number.isFinite(Number(value)))) {
                const encoded = values.map((value) => Buffer.from(value == null ? '' : String(value), 'utf8'));
                const buffer = Buffer.alloc(encoded.reduce((size, bytes) => size + 4 + bytes.byteLength, 0));
                let offset = 0;
                for (const bytes of encoded) {
                    offset = buffer.writeUInt32LE(bytes.byteLength, offset);
                    offset += bytes.copy(buffer, offset);
                }
                stringColumns.push({ name: prop, dtype: 'str', buffer });
                continue;
            }
            const buffer = new ArrayBuffer(values.length * Float32Array.BYTES_PER_ELEMENT);
            new Float32Array(buffer).set(values.map((value) => (
                typeof value === 'number' ? value : Number(value ?? Number.NaN)
            )) as ArrayLike<number>);
            columns.push({ name: prop, dtype: 'f32', buffer: new Uint8Array(buffer) });
        }
        columns.push(...stringColumns);

        const totalAtoms = atomsPage.totalAtoms;
        const totalPages = Math.ceil(totalAtoms / limitNum);

        return {
            count: rowCount,
            total: totalAtoms,
            page,
            limit: limitNum,
            totalPages,
            columns,
            propertyNames: allProps
        };
    }

    #toSceneArtifactOutput(doc: SceneArtifactDocument): Record<string, unknown> {
        return { ...doc.toObject(), _id: String(doc._id) };
    }

    async #listTrajectorySceneArtifacts(input: ListTrajectorySceneArtifactsInputDTO): Promise<PaginatedResult<unknown>> {
        const { trajectoryId, sourceType, analysisId, projection, timestep } = input;
        const parsedTimestep = timestep !== undefined ? Number(timestep) : undefined;

        const filter: Record<string, unknown> = { trajectory: trajectoryId };
        if (sourceType) filter.sourceType = sourceType;
        if (analysisId) filter.analysis = analysisId;
        if (parsedTimestep !== undefined) filter.timestep = parsedTimestep;

        const page = input.page ?? 1;
        const limit = input.limit ?? 100;

        const [docs, total] = await Promise.all([
            SceneArtifactModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
            SceneArtifactModel.countDocuments(filter)
        ]);

        const result: PaginatedResult<unknown> = {
            data: docs.map((doc) => this.#toSceneArtifactOutput(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };

        if (sourceType === 'plugin-exposure' && projection === 'renderable-exposures') {
            const data = this.#projectRenderableExposures(docs);
            return { ...result, total: data.length, data };
        }

        return result;
    }

    #projectRenderableExposures(artifacts: SceneArtifactDocument[]) {
        const byExposureId = new Map<string, SceneArtifactDocument>();

        for (const artifact of artifacts) {
            const exposureId = (artifact.params as { exposureId?: unknown } | undefined)?.exposureId;
            if (!exposureId) continue;
            const metadata = artifact.metadata as Record<string, unknown> | undefined;
            if (typeof metadata?.exporter !== 'string' || !RENDERABLE_SCENE_EXPORTERS.has(metadata.exporter)) {
                continue;
            }

            const current = byExposureId.get(String(exposureId));
            if (!current) {
                byExposureId.set(String(exposureId), artifact);
                continue;
            }

            if (new Date(artifact.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
                byExposureId.set(String(exposureId), artifact);
            }
        }

        return Array.from(byExposureId.values())
            .filter((artifact) => {
                const metadata = artifact.metadata as Record<string, unknown> | undefined;
                return typeof artifact.plugin !== 'undefined'
                    && String(artifact.plugin).length > 0
                    && typeof metadata?.pluginId === 'string'
                    && metadata.pluginId.length > 0;
            })
            .map((artifact) => {
                const metadata = artifact.metadata as Record<string, unknown> | undefined;
                const exposureName = typeof metadata?.exposureName === 'string' ? metadata.exposureName.trim() : '';
                if (!exposureName) return null;

                const pluginId = typeof metadata?.pluginId === 'string' ? metadata.pluginId : '';
                if (!pluginId) return null;

                return {
                    pluginId,
                    analysisId: artifact.analysis ? String(artifact.analysis) : undefined,
                    exposureId: String((artifact.params as { exposureId?: unknown }).exposureId),
                    name: exposureName,
                    icon: undefined,
                    results: 'glb',
                    canvas: true,
                    raster: false,
                    export: {
                        exporter: typeof metadata?.exporter === 'string' ? metadata.exporter : undefined,
                        type: typeof metadata?.exportType === 'string' ? metadata.exportType : undefined,
                        options: {}
                    }
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
    }

    #presentFolder(folder: CatalogFolderDocument): TrajectoryFolderView {
        return {
            _id: String(folder._id),
            title: folder.title,
            parent: folder.parent ? String(folder.parent) : null,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt
        };
    }

    async #deleteFolderTree(teamId: string, folderId: string): Promise<void> {
        const subfolders = await CatalogFolderModel.find({ team: teamId, parent: folderId, kind: CatalogFolderKind.Trajectory });
        for (const subfolder of subfolders) {
            await this.#deleteFolderTree(teamId, String(subfolder._id));
        }

        const trajectories = await TrajectoryModel.find({ team: teamId, folder: folderId }).select('_id').exec();
        for (const trajectoryDoc of trajectories) {
            await this.deleteById({ trajectoryId: String(trajectoryDoc._id), teamId });
        }

        await CatalogFolderModel.deleteOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Trajectory });
    }


    async #getFrames(trajectoryId: string): Promise<TrajectoryFrame[]> {
        const docs = await TrajectoryFrameModel
            .find({ trajectoryId: new mongoose.Types.ObjectId(trajectoryId) })
            .sort({ timestep: 1 })
            .populate('simulationCell')
            .lean<TrajectoryFrameLeanWithPopulatedCell[]>()
            .exec();

        return docs.map(mapFrameLean);
    }

    async #replaceFrames(trajectoryId: string, frames: TrajectoryFrame[]): Promise<void> {
        await TrajectoryFrameModel.deleteMany({ trajectoryId: new mongoose.Types.ObjectId(trajectoryId) }).exec();
        await this.#insertFrames(trajectoryId, frames);
    }

    async #insertFrames(trajectoryId: string, frames: TrajectoryFrame[]): Promise<void> {
        if (frames.length === 0) return;

        const documents = frames.map((frame) => {
            const doc: Record<string, unknown> = {
                trajectoryId: new mongoose.Types.ObjectId(trajectoryId),
                timestep: frame.timestep,
                natoms: frame.natoms
            };

            const cellId = typeof frame.simulationCell === 'string'
                ? frame.simulationCell
                : frame.simulationCell?._id;

            if (cellId) {
                doc.simulationCell = new mongoose.Types.ObjectId(cellId);
            }

            return doc;
        });

        await TrajectoryFrameModel.collection.insertMany(documents, { ordered: false }).catch((error) => {
            if ((error as { code?: number }).code === 11000) return;
            throw error;
        });
    }

    async #getFrameListingSummaries(
        trajectoryIds: string[]
    ): Promise<Map<string, { framesCount: number; atoms: number; firstTimestep: number }>> {
        const summaries = new Map<string, { framesCount: number; atoms: number; firstTimestep: number }>();
        if (trajectoryIds.length === 0) return summaries;

        const rows = await TrajectoryFrameModel.aggregate<{
            _id: mongoose.Types.ObjectId;
            framesCount: number;
            atoms: number;
            firstTimestep: number;
        }>([
            { $match: { trajectoryId: { $in: trajectoryIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
            { $sort: { trajectoryId: 1, timestep: 1 } },
            {
                $group: {
                    _id: '$trajectoryId',
                    framesCount: { $sum: 1 },
                    atoms: { $first: '$natoms' },
                    firstTimestep: { $first: '$timestep' }
                }
            }
        ]).exec();

        for (const row of rows) {
            summaries.set(row._id.toString(), {
                framesCount: row.framesCount,
                atoms: row.atoms,
                firstTimestep: row.firstTimestep
            });
        }

        return summaries;
    }
}
