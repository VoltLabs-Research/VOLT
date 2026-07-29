import eventBus from '@shared/infrastructure/events/RedisEventBus';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import { ErrorCodes } from '@core/constants/error-codes';
import { STATIC_ROOT } from '@core/config/paths';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrameEntity from '@modules/trajectory/models/TrajectoryFrame';
import TrajectoryUploadSession from '@modules/trajectory/models/TrajectoryUploadSession';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';

import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';
import type { TrajectoryFrame } from '@shared/contracts/types/Trajectory';
import TrajectoryCloneJob from '@modules/trajectory/models/TrajectoryCloneJob';
import { createTrajectoryCloneJobStats } from '@modules/trajectory/contracts/domain/trajectory-clone-job';
import { TrajectoryUploadSessionStatus } from '@modules/trajectory/contracts/domain/trajectory-upload-session';
import type { TrajectoryUploadSessionFileProps } from '@modules/trajectory/contracts/domain/trajectory-upload-session';

import trajectoryNativeDaemonService from '@modules/trajectory/services/native/TrajectoryNativeDaemonService';
import trajectoryReader, { getTrajectoryFrames, readTrajectoryPreview } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import colorCodingService from '@modules/trajectory/services/color-coding/ColorCodingService';
import particleFilterService, { buildParticleFilterRequest } from '@modules/trajectory/services/particle-filter/ParticleFilterService';
import lineStyleService, { type LineStyleSpec } from '@modules/trajectory/services/line-style/LineStyleService';
import atomPropertiesService from '@modules/trajectory/services/trajectory/AtomPropertiesService';
import trajectoryDumpStorageService from '@modules/trajectory/services/trajectory/TrajectoryDumpStorageService';
import teamMetricsQueryService from '@modules/trajectory/services/trajectory/TeamMetricsQueryService';
import trajectoryCloneRunner from '@modules/trajectory/services/trajectory/TrajectoryCloneRunner';

import trajectoryCloneCoordinator from '@modules/trajectory/services/TrajectoryCloneCoordinator';

import {
    buildTrajectoryDumpObjectName,
    buildTrajectoryGlbObjectName
} from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';
import { normalizeAnalysisId } from '@modules/trajectory/services/trajectory/TrajectoryAnalysis';

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
import type { DownloadStreamOutput } from '@shared/contracts/types';
import ClusterObjectSignedUrlService from '@modules/cluster/services/ClusterObjectSignedUrlService';
import ClusterObjectArchiveService from '@modules/cluster/services/ClusterObjectArchiveService';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import storagePlacementService from '@modules/cluster/services/StoragePlacementService';
import daemonAnalysisCompletionService from '@modules/cluster/services/DaemonAnalysisCompletionService';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import type {
    ITeamClusterObjectGatewayClient,
    ITeamClusterSelectionService,
    IStoragePlacementService,
    ClusterArchiveReference,
    ClusterArchiveObjectEntry,
    IDaemonAnalysisCompletionService
} from '@shared/contracts/ports';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import {
    buildAnalysisRelationOptions,
    escapeLikePattern,
    findRuntimeTargetsByTrajectoryId,
    toAnalysisLike
} from '@modules/analysis/services/AnalysisQueries';
import { AnalysisRelation } from '@modules/analysis/contracts/domain/analysis';
import type { AnalysisRelationName } from '@modules/analysis/contracts/domain/analysis';
import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import PluginService from '@modules/plugin/services/PluginService';
import { insertSimulationCells } from '@modules/simulation-cell/services/SimulationCellService';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import { generateEntityId } from '@shared/infrastructure/persistence/entity-id';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { StreamableOutput } from '@shared/contracts/types/StreamableOutput';

import { ILike, In, IsNull } from 'typeorm';
import type { DeepPartial, FindOptionsOrder, FindOptionsWhere } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import sharp from 'sharp';
import pLimit from 'p-limit';
import { v4 } from 'uuid';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

import type {
    CreateTrajectoryOutput,
    TrajectoryRecord,
    GetTrajectoryByIdOutput,
    GetTrajectoriesByTeamIdInput,
    GetTrajectoriesByTeamIdOutput,
    UpdateTrajectoryByIdInput,
    UpdateTrajectoryByIdOutput,
    MoveTrajectoryInput,
    MoveTrajectoryOutput,
    GetTeamMetricsInput,
    GetTeamMetricsOutput,
    GetTrajectoryPreviewInput,
    GetTrajectoryPreviewOutput,
    PublicTeamDiscoveryView,
    ListPublicTeamTrajectoriesInput,
    ListPublicTeamTrajectoriesOutput,
    CloneTrajectoryInput,
    CloneTrajectoryOutput,
    DownloadTrajectoryInput,
    DownloadTrajectoryOutput,
    DownloadTrajectoryAnalysesInput,
    DownloadTrajectoryAnalysesOutput,
    DownloadSampleSimulationsInput,
    DownloadSampleSimulationsOutput,
    TrajectoryUploadSessionFileInput,
    CreateTrajectoryUploadSessionInput,
    CreateTrajectoryUploadSessionOutput,
    TrajectoryUploadSessionFileView,
    CommitTrajectoryUploadSessionInput,
    CommitTrajectoryUploadSessionOutput,
    CancelTrajectoryUploadSessionInput,
    CreateColoredModelInput,
    CreateColoredModelOutput,
    GetColorCodingPropertiesInput,
    GetColorCodingPropertiesOutput,
    GetColorCodingStatsInput,
    GetColorCodingStatsOutput,
    GetColoredModelStreamInput,
    GetColoredModelStreamOutput,
    PreviewParticleFilterInput,
    PreviewParticleFilterOutput,
    ApplyParticleFilterActionInput,
    ApplyParticleFilterActionOutput,
    GetFilteredModelStreamInput,
    GetFilteredModelStreamOutput,
    GetParticleFilterPropertiesInput,
    GetParticleFilterPropertiesOutput,
    GetParticleFilterUniqueValuesInput,
    GetParticleFilterUniqueValuesOutput,
    CreateLineStyledModelInput,
    CreateLineStyledModelOutput,
    GetLineStyledModelStreamInput,
    GetLineStyledModelStreamOutput,
    GetLineModelRangesStreamInput,
    GetOctreeMetadataStreamInput,
    GetLineEntityPropertiesInput,
    GetLineEntityPropertiesOutput,
    TeamSceneArtifactOutput,
    ListTeamSceneArtifactsInput,
    ListTeamSceneArtifactsOutput,
    ListTrajectorySceneArtifactsInput,
    GetPublicCanvasBootstrapInput,
    GetPublicCanvasBootstrapOutput,
    PublicCanvasBootstrapTrajectoryView,
    GetPublicCanvasGLBInput,
    GetPublicCanvasGLBOutput,
    GetPublicCanvasRasterFrameInput,
    GetPublicCanvasRasterFrameOutput
} from '@modules/trajectory/services/TrajectoryServiceTypes';
import { PublicCanvasAccessMode } from '@modules/trajectory/services/TrajectoryServiceTypes';
import type {
    GetAtomsColumnarInput,
    GetAtomsColumnarOutput,
    AtomColumn
} from '@modules/trajectory/services/TrajectoryServiceTypes';
import type { GetRasterMetadataOutput } from '@shared/contracts/operations/GetRasterMetadata';
import type { GetSimulationCellByTrajectoryOutput } from '@shared/contracts/operations/GetSimulationCellByTrajectory';
import type { GetAnalysisFrameLogOutput } from '@shared/contracts/operations/GetAnalysisFrameLog';
import type { GetPluginExposureGLBOutput, GetPluginByIdOutput, GetPluginListingDocumentsOutput, GetSubListingOutput } from '@shared/contracts/operations';
import type { GetAnalysesByTrajectoryIdOutput } from '@shared/contracts/operations/GetAnalysesByTrajectoryId';

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
const ANALYSIS_LIST_DEFAULT_LIMIT = 100;
const ANALYSIS_LIST_MAX_LIMIT = 1000;
const TRAJECTORY_LIST_DEFAULT_LIMIT = 20;
const FOLDER_LIST_DEFAULT_LIMIT = 500;
const SCENE_ARTIFACT_LIST_DEFAULT_LIMIT = 100;
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

const storageClusterIdOf = (trajectory: { storageClusterId?: string }): string | undefined => (
    trajectory.storageClusterId ? String(trajectory.storageClusterId) : undefined
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
        return [{
            partNumber: 1,
            objectKey: finalObjectKey,
            offset: 0,
            size
        }];
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

const USER_SELECTION = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true
} as const;

const CLUSTER_NAME_SELECTION = {
    id: true,
    name: true
} as const;

const TRAJECTORY_LISTING_RELATIONS = {
    relations: {
        createdByRef: true,
        storageClusterIdRef: true
    },
    select: {
        createdByRef: USER_SELECTION,
        storageClusterIdRef: CLUSTER_NAME_SELECTION
    }
} as const;

export default class TrajectoryService {
    #eventBus = eventBus;
    #objectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClient;
    #teamClusterDaemonClient = teamClusterDaemonClient;
    #clusterSelection: ITeamClusterSelectionService = teamClusterSelectionService;
    #storagePlacement = storagePlacementService;
    #signedUrlService = new ClusterObjectSignedUrlService();
    #archiveService = new ClusterObjectArchiveService();
    #daemonAnalysisCompletionService: IDaemonAnalysisCompletionService = daemonAnalysisCompletionService;
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

    async createUploadSession(input: CreateTrajectoryUploadSessionInput): Promise<CreateTrajectoryUploadSessionOutput> {
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
            const folder = await CatalogFolder.findOneBy({
                id: input.folderId,
                team: teamId,
                kind: CatalogFolderKind.Trajectory
            });
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
            stats: {
                totalFiles: 0,
                totalSize: 0
            },
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

        const uploadSession = await TrajectoryUploadSession.create({
            team: teamId,
            user: userId,
            ownerClusterId: storageClusterId,
            bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
            resourceKind: 'trajectory',
            resourceId: trajectory.id,
            files: sessionFiles,
            expiresAt
        }).save();

        await this.#eventBus.emit('trajectory.created', {
            trajectoryId: trajectory.id,
            trajectoryName: name,
            teamId,
            userId
        });

        const filesOutput: TrajectoryUploadSessionFileView[] = sessionFiles.map((file) => ({
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
                    sessionId: uploadSession.id,
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
            trajectory: this.#toTrajectoryOutput(trajectory) as unknown as CreateTrajectoryOutput,
            uploadSession: {
                id: uploadSession.id,
                chunkSize: TRAJECTORY_UPLOAD_CHUNK_SIZE,
                expiresAt: expiresAt.toISOString(),
                files: filesOutput
            }
        };
    }

    async commitUploadSession(input: CommitTrajectoryUploadSessionInput): Promise<CommitTrajectoryUploadSessionOutput> {
        const session = await TrajectoryUploadSession.findOneBy({ id: input.uploadSessionId });
        if (!session) {
            throw ApplicationError.notFound('TrajectoryUploadSession::NotFound', 'Upload session not found');
        }

        const trajectoryId = session.resourceId;

        if (session.status === TrajectoryUploadSessionStatus.Committed) {
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
                session.ownerClusterId,
                ChannelCommands.TrajectoryIngest,
                {
                    trajectoryId,
                    teamId: input.teamId,
                    stagedObjects
                },
                { timeoutMs: 0 }
            );

            const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
            const trajectoryName = trajectory?.name || 'Trajectory';
            const frames = await this.#buildPersistableFrames(trajectoryId, input.teamId, result.frames);

            if (trajectory) {
                await Object.assign(trajectory, {
                    status: TrajectoryStatus.Processing,
                    stats: result.stats
                }).save();
            }
            await this.#replaceFrames(trajectoryId, frames);

            await this.#daemonAnalysisCompletionService.initializeGlbSession(trajectoryId, frames.length, input.teamId);

            await this.#daemonAnalysisCompletionService.handleQueuedJobs(
                this.#buildQueuedGlbJobs(trajectoryId, trajectoryName, input.teamId, frames),
                'glb',
                session.ownerClusterId
            ).catch((projectionError) => {
                logger.warn(
                    projectionError,
                    `[TrajectoryService] Failed to project queued GLB jobs for ${trajectoryId}`
                );
            });

            await Object.assign(session, {
                status: TrajectoryUploadSessionStatus.Committed,
                committedAt: new Date()
            }).save();

            await this.#eventBus.emit('trajectory.updated', {
                trajectoryId,
                teamId: input.teamId,
                updates: {
                    status: TrajectoryStatus.Processing,
                    stats: result.stats
                },
                updatedAt: new Date()
            });

            return { trajectoryId };
        } catch (error) {
            logger.error(error, `[TrajectoryService] Commit failed for uploadSessionId=${session.id}`);
            await Object.assign(session, { status: TrajectoryUploadSessionStatus.Failed }).save().catch(() => {});
            const trajectory = await Trajectory.findOneBy({ id: trajectoryId }).catch(() => null);
            await this.#deleteTrajectoryById(trajectoryId).catch((deleteError) => {
                logger.warn(deleteError, `[TrajectoryService] Failed to delete orphaned trajectory ${trajectoryId}`);
            });
            await this.#eventBus.emit('trajectory.deleted', {
                trajectoryId,
                teamId: input.teamId,
                storageClusterId: trajectory ? storageClusterIdOf(trajectory) : undefined,
                userId: input.userId ?? '',
                trajectoryName: trajectory?.name ?? 'Trajectory',
                analysisIds: [],
                analysisComputeClusterIds: []
            }).catch(() => {});

            if (isNoValidFramesError(error)) {
                throw ApplicationError.unprocessableEntity(
                    ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES,
                    'The uploaded file does not contain any readable trajectory frames. Upload a supported trajectory dump (e.g. a LAMMPS dump, XYZ, or a ZIP of frames).'
                );
            }

            throw error;
        }
    }

    async cancelUploadSession(input: CancelTrajectoryUploadSessionInput): Promise<void> {
        const session = await TrajectoryUploadSession.findOneBy({ id: input.uploadSessionId });
        if (!session) {
            throw ApplicationError.notFound('TrajectoryUploadSession::NotFound', 'Upload session not found');
        }

        if (session.team !== input.teamId || session.user !== input.userId) {
            throw ApplicationError.forbidden(
                'TrajectoryUploadSession::Forbidden',
                'Upload session does not belong to this user and team'
            );
        }

        if (session.status === TrajectoryUploadSessionStatus.Committed) {
            throw ApplicationError.conflict(
                'TrajectoryUploadSession::AlreadyCommitted',
                'Committed upload sessions cannot be cancelled'
            );
        }

        const ownerClusterId = session.ownerClusterId;
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

        await Object.assign(session, { status: TrajectoryUploadSessionStatus.Cancelled }).save();
        await Trajectory.update({ id: session.resourceId }, { status: TrajectoryStatus.Failed }).catch(() => {});
    }

    async deleteById(input: { trajectoryId: string; teamId?: string; userId?: string }): Promise<{ success: boolean }> {
        const trajectory = await Trajectory.findOneBy({ id: input.trajectoryId });
        if (!trajectory) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        const analysisRuntimeTargets = await findRuntimeTargetsByTrajectoryId(input.trajectoryId);
        const deleted = await this.#deleteTrajectoryById(input.trajectoryId);
        if (!deleted) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        await this.#eventBus.emit('trajectory.deleted', {
            trajectoryId: input.trajectoryId,
            teamId: input.teamId ?? trajectory.team ?? '',
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
        });

        return { success: true };
    }

    async getTeamMetrics(input: GetTeamMetricsInput): Promise<GetTeamMetricsOutput> {
        return this.#teamMetrics.getTeamMetrics(input.teamId);
    }

    async getByTeamId(input: GetTrajectoriesByTeamIdInput): Promise<GetTrajectoriesByTeamIdOutput> {
        const { teamId, search } = input;
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: TRAJECTORY_LIST_DEFAULT_LIMIT });

        const where: FindOptionsWhere<Trajectory> = { team: teamId };
        if (input.folderId === 'root') {
            where.folder = IsNull();
        } else if (input.folderId) {
            where.folder = input.folderId;
        }
        if (search) {
            where.name = ILike(`%${escapeLikePattern(search)}%`);
        }

        const [trajectories, total] = await Trajectory.findAndCount({
            where,
            ...TRAJECTORY_LISTING_RELATIONS,
            order: { updatedAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        const summaries = await this.#getFrameListingSummaries(trajectories.map((trajectory) => trajectory.id));

        const data = trajectories.map((trajectory) => {
            const view = this.#toTrajectoryOutput(trajectory) as unknown as TrajectoryRecord;
            const summary = summaries.get(trajectory.id);
            view.framesCount = summary?.framesCount ?? 0;
            view.atoms = summary?.atoms ?? 0;
            view.firstTimestep = summary?.firstTimestep;
            return view;
        });

        return paginate([data, total], pageRequest);
    }

    async getById(input: { trajectoryId: string; options?: { populate?: unknown; select?: string[] } }): Promise<GetTrajectoryByIdOutput> {
        const trajectory = await Trajectory.findOne({
            where: { id: input.trajectoryId },
            relations: { teamRef: true }
        });
        if (!trajectory) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        const view = this.#toTrajectoryOutput(trajectory) as unknown as GetTrajectoryByIdOutput;
        (view as unknown as { frames: TrajectoryFrame[] }).frames = await this.#getFrames(trajectory.id);
        return view;
    }

    async updateById(input: UpdateTrajectoryByIdInput): Promise<UpdateTrajectoryByIdOutput> {
        const { trajectoryId, name, isPublic } = input;
        const trajectory = await Trajectory.findOne({
            where: { id: trajectoryId },
            relations: { teamRef: true }
        });

        if (!trajectory) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        const updated = await Object.assign(trajectory, {
            name,
            isPublic
        }).save();

        return this.#toTrajectoryOutput(updated) as unknown as UpdateTrajectoryByIdOutput;
    }

    async move(input: MoveTrajectoryInput): Promise<MoveTrajectoryOutput> {
        try {
            const trajectory = await Trajectory.findOneBy({
                id: input.trajectoryId,
                team: input.teamId
            });
            if (!trajectory) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found');
            }

            if (input.folderId !== null) {
                const folder = await CatalogFolder.findOneBy({
                    id: input.folderId,
                    team: input.teamId,
                    kind: CatalogFolderKind.Trajectory
                });
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

    async cloneTrajectory(input: CloneTrajectoryInput): Promise<CloneTrajectoryOutput> {
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
            const sourceFrames = await this.#getFrames(source.id);

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

            const job = await TrajectoryCloneJob.create({
                team: input.teamId,
                sourceTrajectoryId: source.id,
                destinationTrajectoryId: destinationTrajectory.id,
                sourceClusterId,
                destinationClusterId,
                requestedBy: input.userId,
                stats: createTrajectoryCloneJobStats({ totalFrames: sourceFrames.length })
            }).save();

            await this.#cloneCoordinator.publishJobProjection(job);

            try {
                this.#cloneRunner.kick(1);
            } catch (error) {
                logger.warn({ err: error }, '[TrajectoryService] Failed to kick clone runner');
            }

            await this.#eventBus.emit('trajectory.created', {
                trajectoryId: destinationTrajectory.id,
                trajectoryName: destinationTrajectory.name,
                teamId: input.teamId,
                userId: input.userId
            });

            return {
                trajectoryId: destinationTrajectory.id,
                jobId: job.id,
                sourceTrajectoryId: source.id,
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

    async getPreview(input: GetTrajectoryPreviewInput): Promise<GetTrajectoryPreviewOutput> {
        const { trajectoryId } = input;

        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
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

    async downloadTrajectory(input: DownloadTrajectoryInput): Promise<DownloadTrajectoryOutput> {
        const { trajectoryId, archive } = input;

        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
        if (!trajectory || trajectory.team !== input.teamId) {
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

    async #findAnalyses(options: {
        where: FindOptionsWhere<AnalysisEntity>;
        relations?: readonly AnalysisRelationName[];
        order?: FindOptionsOrder<AnalysisEntity>;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResult<AnalysisEntity>> {
        const { where, relations, order } = options;
        const pageRequest = readPageRequest(options.page, options.limit, {
            defaultLimit: ANALYSIS_LIST_DEFAULT_LIMIT,
            maxLimit: ANALYSIS_LIST_MAX_LIMIT
        });

        const [analyses, total] = await AnalysisEntity.findAndCount({
            where,
            ...buildAnalysisRelationOptions(relations),
            ...(order === undefined ? {} : { order }),
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([analyses, total], pageRequest);
    }

    async downloadTrajectoryAnalyses(input: DownloadTrajectoryAnalysesInput): Promise<DownloadTrajectoryAnalysesOutput> {
        const trajectory = await Trajectory.findOneBy({ id: input.trajectoryId });
        if (!trajectory || trajectory.team !== input.teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        const analyses = await this.#findAnalyses({
            where: {
                trajectory: input.trajectoryId,
                team: input.teamId
            },
            order: { createdAt: 'DESC' },
            limit: ANALYSIS_LIST_MAX_LIMIT
        });

        const completedAnalyses = analyses.data.filter((analysis) => (
            String(analysis.status || '').toLowerCase() === ANALYSIS_STATUS_COMPLETED
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
            limit(() => this.#buildAnalysisArchiveEntry(analysis.id, input.teamId))
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

    async downloadSamples(input: DownloadSampleSimulationsInput): Promise<DownloadSampleSimulationsOutput> {
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

        return {
            stream: createReadStream(filePath),
            filename
        };
    }

    async getAtoms(input: GetAtomsColumnarInput): Promise<GetAtomsColumnarOutput> {
        try {
            const { trajectoryId, timestep } = input;
            const analysisId = normalizeAnalysisId(input.analysisId);
            const page = Math.max(1, input.page ?? 1);
            const limitNum = Math.min(5_000_000, Math.max(1, input.limit ?? 5_000_000));

            const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
            if (!trajectory) {
                throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
            }

            const ownerClusterId = storageClusterIdOf(trajectory);
            let teamClusterId: string | undefined;
            if (analysisId) {
                const analysis = await AnalysisEntity.findOneBy({ id: analysisId });
                if (!analysis) {
                    throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
                }
                if (analysis.trajectory !== trajectoryId) {
                    throw ApplicationError.badRequest(
                        ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                        'Analysis does not belong to the requested trajectory'
                    );
                }
                teamClusterId = resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined }) ?? teamClusterId;
            } else if (ownerClusterId) {
                teamClusterId = await this.#clusterSelection.resolveComputeClusterId(trajectory.team, undefined, ownerClusterId);
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
        const pageRequest = readPageRequest(query.page, query.limit, { defaultLimit: FOLDER_LIST_DEFAULT_LIMIT });
        const where: FindOptionsWhere<CatalogFolder> = {
            team: teamId,
            kind: CatalogFolderKind.Trajectory,
            parent: query.parentId ?? IsNull()
        };

        const [folders, total] = await CatalogFolder.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([folders.map((folder) => this.#presentFolder(folder)), total], pageRequest);
    }

    async getFolder(teamId: string, folderId: string): Promise<TrajectoryFolderView> {
        const folder = await CatalogFolder.findOneBy({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Trajectory
        });
        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory folder not found');
        }
        return this.#presentFolder(folder);
    }

    async createFolder(teamId: string, userId: string, input: { title: string; parentId?: string | null }): Promise<TrajectoryFolderView> {
        const folder = await CatalogFolder.create({
            team: teamId,
            createdBy: userId,
            title: input.title,
            parent: input.parentId ?? null,
            kind: CatalogFolderKind.Trajectory
        }).save();
        return this.#presentFolder(folder);
    }

    async updateFolder(teamId: string, folderId: string, input: { title: string }): Promise<TrajectoryFolderView> {
        const folder = await CatalogFolder.findOneBy({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Trajectory
        });
        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory folder not found');
        }
        folder.title = input.title;
        await folder.save();
        return this.#presentFolder(folder);
    }

    async deleteFolder(teamId: string, folderId: string): Promise<null> {
        try {
            const folder = await CatalogFolder.findOneBy({
                id: folderId,
                team: teamId,
                kind: CatalogFolderKind.Trajectory
            });
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

    async getSceneArtifacts(input: ListTrajectorySceneArtifactsInput): Promise<PaginatedResult<unknown>> {
        return this.#listTrajectorySceneArtifacts(input);
    }

    async listTeamSceneArtifacts(input: ListTeamSceneArtifactsInput): Promise<ListTeamSceneArtifactsOutput> {
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: SCENE_ARTIFACT_LIST_DEFAULT_LIMIT });

        const query = SceneArtifact.createQueryBuilder('artifact')
            .innerJoinAndSelect('artifact.trajectoryRef', 'trajectory')
            .leftJoinAndSelect('trajectory.storageClusterIdRef', 'trajectoryStorageCluster')
            .leftJoinAndSelect('artifact.storageClusterIdRef', 'artifactStorageCluster')
            .select([
                'artifact',
                'trajectory.id',
                'trajectory.name',
                'trajectory.storageClusterId',
                'trajectoryStorageCluster.id',
                'trajectoryStorageCluster.name',
                'artifactStorageCluster.id',
                'artifactStorageCluster.name'
            ])
            .where('trajectory.team = :teamId', { teamId: input.teamId });

        if (input.sourceType) {
            query.andWhere('artifact.sourceType = :sourceType', { sourceType: input.sourceType });
        }
        if (input.analysisId) {
            query.andWhere('artifact.analysis = :analysisId', { analysisId: input.analysisId });
        }
        if (input.timestep !== undefined) {
            query.andWhere('artifact.timestep = :timestep', { timestep: input.timestep });
        }

        const [artifacts, total] = await query
            .orderBy('artifact.updatedAt', 'DESC')
            .addOrderBy('artifact.id', 'DESC')
            .skip(skipFor(pageRequest))
            .take(pageRequest.limit)
            .getManyAndCount();

        return paginate(
            [artifacts.map((artifact) => this.#toSceneArtifactOutput(artifact) as unknown as TeamSceneArtifactOutput), total],
            pageRequest
        );
    }

    async getColorCodingProperties(input: GetColorCodingPropertiesInput): Promise<GetColorCodingPropertiesOutput> {
        return this.#runService(() => this.#colorCoding.getProperties(input.trajectoryId, input.timestep, input.analysisId));
    }

    async getColorCodingStats(input: GetColorCodingStatsInput): Promise<GetColorCodingStatsOutput> {
        return this.#runService(() => this.#colorCoding.getStats(
            input.trajectoryId,
            input.timestep,
            input.property,
            input.type,
            input.analysisId,
            input.exposureId
        ));
    }

    async createColoredModel(input: CreateColoredModelInput): Promise<CreateColoredModelOutput> {
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

    async getColoredModelStream(input: GetColoredModelStreamInput): Promise<GetColoredModelStreamOutput & StreamableOutput> {
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
        return response as GetColoredModelStreamOutput & StreamableOutput;
    }

    async getParticleFilterProperties(input: GetParticleFilterPropertiesInput): Promise<GetParticleFilterPropertiesOutput> {
        return this.#runService(() => this.#particleFilter.getProperties(input.trajectoryId, input.timestep, input.analysisId));
    }

    async previewParticleFilter(input: PreviewParticleFilterInput): Promise<PreviewParticleFilterOutput> {
        return this.#particleFilter.preview(
            input.trajectoryId,
            input.timestep,
            buildParticleFilterRequest(input),
            input.analysisId
        );
    }

    async applyParticleFilterAction(input: ApplyParticleFilterActionInput): Promise<ApplyParticleFilterActionOutput> {
        return this.#particleFilter.applyAction(
            input.trajectoryId,
            input.timestep,
            input.action,
            buildParticleFilterRequest(input),
            input.analysisId
        );
    }

    async getFilteredModelStream(input: GetFilteredModelStreamInput): Promise<GetFilteredModelStreamOutput & StreamableOutput> {
        const response = await this.#particleFilter.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            buildParticleFilterRequest(input),
            input.action,
            input.analysisId
        );
        return response as GetFilteredModelStreamOutput & StreamableOutput;
    }

    async getParticleFilterUniqueValues(input: GetParticleFilterUniqueValuesInput): Promise<GetParticleFilterUniqueValuesOutput> {
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

    async createLineStyledModel(input: CreateLineStyledModelInput): Promise<CreateLineStyledModelOutput> {
        return this.#lineStyle.createStyledModel(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            input.style ?? {}
        );
    }

    async getLineStyledModelStream(input: GetLineStyledModelStreamInput): Promise<GetLineStyledModelStreamOutput & StreamableOutput> {
        const response = await this.#lineStyle.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            parseLineStyle(input.style)
        );
        return response as GetLineStyledModelStreamOutput & StreamableOutput;
    }

    async getLineModelRangesStream(input: GetLineModelRangesStreamInput): Promise<StreamableOutput> {
        const response = await this.#lineStyle.getRangesStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            input.style ? parseLineStyle(input.style) : undefined
        );
        return response as StreamableOutput;
    }

    async getLineEntityProperties(input: GetLineEntityPropertiesInput): Promise<GetLineEntityPropertiesOutput> {
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

        return {
            entityId,
            properties
        };
    }

    async getOctreeMetadataStream(input: GetOctreeMetadataStreamInput): Promise<StreamableOutput> {
        const response = await this.#lineStyle.getOctreeMetadataStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId
        );
        return response as StreamableOutput;
    }

    async listPublicTeamTrajectories(input: ListPublicTeamTrajectoriesInput): Promise<ListPublicTeamTrajectoriesOutput> {
        const { teamId } = input;
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: TRAJECTORY_LIST_DEFAULT_LIMIT });
        const team = await Team.findOneBy({ id: teamId });
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        const where: FindOptionsWhere<Trajectory> = {
            team: teamId,
            isPublic: true
        };
        const search = input.search?.trim();
        if (search) {
            where.name = ILike(`%${escapeLikePattern(search)}%`);
        }

        const [trajectories, total] = await Trajectory.findAndCount({
            where,
            select: {
                id: true,
                name: true,
                team: true,
                status: true,
                isPublic: true,
                hasPreview: true,
                stats: true,
                createdAt: true,
                updatedAt: true
            },
            order: { updatedAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        const summaries = await this.#getFrameListingSummaries(trajectories.map((trajectory) => trajectory.id));

        const data = trajectories.map((trajectory) => {
            const view = this.#toTrajectoryOutput(trajectory) as unknown as TrajectoryRecord;
            const summary = summaries.get(trajectory.id);
            view.framesCount = summary?.framesCount ?? 0;
            view.atoms = summary?.atoms ?? 0;
            view.firstTimestep = summary?.firstTimestep;
            return view;
        });

        const teamDiscovery: PublicTeamDiscoveryView = {
            _id: team.id,
            name: team.name
        };

        return paginate([data, total], pageRequest, { team: teamDiscovery }) as ListPublicTeamTrajectoriesOutput;
    }

    async getPublicCanvasBootstrap(input: GetPublicCanvasBootstrapInput): Promise<GetPublicCanvasBootstrapOutput> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);

        let hasTeamMembership = false;
        if (input.userId) {
            hasTeamMembership = await TeamMember.existsBy({
                team: trajectory.team,
                user: input.userId
            });
        }

        const frames = await this.#getFrames(trajectory.id);

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

    async getPublicCanvasTrajectory(input: { trajectoryId: string; userId?: string }): Promise<GetTrajectoryByIdOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        return this.getById({ trajectoryId: input.trajectoryId });
    }

    async getPublicCanvasPreview(input: { trajectoryId: string; userId?: string }): Promise<GetTrajectoryPreviewOutput> {
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

    async getPublicCanvasRasterFrame(input: GetPublicCanvasRasterFrameInput): Promise<GetPublicCanvasRasterFrameOutput> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);
        return new RasterService().getRasterFramePNG({
            trajectoryId: input.trajectoryId,
            teamId: trajectory.team,
            timestep: input.timestep,
            analysisId: input.analysisId,
            model: input.model
        });
    }

    async getPublicCanvasDump(input: { trajectoryId: string; timestep: string; userId?: string }): Promise<DownloadStreamOutput> {
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

    async getPublicCanvasGLB(input: GetPublicCanvasGLBInput): Promise<GetPublicCanvasGLBOutput> {
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

    async listPublicCanvasAnalyses(input: { trajectoryId: string; userId?: string; page?: number; limit?: number }): Promise<GetAnalysesByTrajectoryIdOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);

        const analyses = await this.#findAnalyses({
            where: { trajectory: input.trajectoryId },
            relations: [AnalysisRelation.Trajectory, AnalysisRelation.Plugin],
            page: input.page,
            limit: input.limit,
            order: { createdAt: 'DESC' }
        });

        const data = analyses.data.map((entity) => {
            const analysis = toAnalysisLike(entity);
            const props = { ...analysis.props };
            const pluginId = extractPluginId(props.plugin);
            return {
                ...props,
                _id: analysis._id,
                plugin: pluginId
            };
        });

        return {
            ...analyses,
            data
        } as unknown as GetAnalysesByTrajectoryIdOutput;
    }

    async getPublicCanvasSimulationCell(input: { trajectoryId: string; timestep?: number; userId?: string }): Promise<GetSimulationCellByTrajectoryOutput> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);
        return new SimulationCellService().getByTrajectory({
            teamId: trajectory.team,
            trajectoryId: input.trajectoryId,
            timestep: input.timestep
        });
    }

    async listPublicCanvasSceneArtifacts(input: ListTrajectorySceneArtifactsInput & { userId?: string }): Promise<PaginatedResult<unknown>> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.#listTrajectorySceneArtifacts(delegated);
    }

    async getPublicCanvasColorCodingProperties(input: GetColorCodingPropertiesInput & { userId?: string }): Promise<GetColorCodingPropertiesOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getColorCodingProperties(delegated);
    }

    async getPublicCanvasColorCodingStats(input: GetColorCodingStatsInput & { userId?: string }): Promise<GetColorCodingStatsOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getColorCodingStats(delegated);
    }

    async getPublicCanvasColoredModelStream(input: GetColoredModelStreamInput & { userId?: string }): Promise<StreamableOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getColoredModelStream(delegated);
    }

    async getPublicCanvasParticleFilterProperties(input: GetParticleFilterPropertiesInput & { userId?: string }): Promise<GetParticleFilterPropertiesOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getParticleFilterProperties(delegated);
    }

    async getPublicCanvasParticleFilterUniqueValues(input: GetParticleFilterUniqueValuesInput & { userId?: string }): Promise<GetParticleFilterUniqueValuesOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getParticleFilterUniqueValues(delegated);
    }

    async getPublicCanvasParticleFilterPreview(input: PreviewParticleFilterInput & { userId?: string }): Promise<PreviewParticleFilterOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.previewParticleFilter(delegated);
    }

    async getPublicCanvasFilteredModelStream(input: GetFilteredModelStreamInput & { userId?: string }): Promise<StreamableOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        const { userId: _userId, ...delegated } = input;
        return this.getFilteredModelStream(delegated);
    }

    async getPublicCanvasPlugin(input: { trajectoryId: string; pluginId: string; userId?: string }): Promise<GetPluginByIdOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);

        const analyses = await this.#findAnalyses({
            where: { trajectory: input.trajectoryId },
            limit: ANALYSIS_LIST_MAX_LIMIT
        });
        const pluginAttached = analyses.data.some((analysis) => extractPluginId(analysis.plugin) === input.pluginId);

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
    }): Promise<GetPluginListingDocumentsOutput> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);
        const teamId = trajectory.team;

        if (input.analysisId) {
            const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });
            if (!analysis) {
                throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
            }
            if (analysis.trajectory !== input.trajectoryId) {
                throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH, 'Analysis does not belong to the requested trajectory');
            }
            if (extractPluginId(analysis.plugin) !== input.pluginId) {
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
    }): Promise<GetSubListingOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);

        const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });
        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }
        if (analysis.trajectory !== input.trajectoryId) {
            throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH, 'Analysis does not belong to the requested trajectory');
        }

        return this.#pluginService.getSubListing({
            analysisId: input.analysisId,
            exposureId: input.exposureId,
            timestep: input.timestep,
            subListingName: input.subListingName,
            teamId: analysis.team,
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
    }): Promise<GetPluginExposureGLBOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);

        const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });
        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }
        if (analysis.trajectory !== input.trajectoryId) {
            throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH, 'Analysis does not belong to the requested trajectory');
        }

        return this.#pluginService.getPluginExposureGLB({
            teamId: analysis.team,
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
    }): Promise<GetAnalysisFrameLogOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);

        const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });
        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }
        if (analysis.trajectory !== input.trajectoryId) {
            throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH, 'Analysis does not belong to the requested trajectory');
        }

        return analysisExecutionLogService.getFrameLog({
            teamId: analysis.team,
            analysisId: input.analysisId,
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            afterCursor: input.afterCursor
        });
    }

    async getPublicCanvasRasterMetadata(input: { trajectoryId: string; userId?: string }): Promise<GetRasterMetadataOutput> {
        const trajectory = await this.#assertReadable(input.trajectoryId, input.userId);
        return new RasterService().getRasterMetadata({
            trajectoryId: input.trajectoryId,
            teamId: trajectory.team
        });
    }

    async getPublicCanvasAtoms(input: { trajectoryId: string; analysisId?: string; timestep: number; page?: number; limit?: number; userId?: string }): Promise<GetAtomsColumnarOutput> {
        await this.#assertReadable(input.trajectoryId, input.userId);
        return this.getAtoms({
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            timestep: input.timestep,
            page: input.page,
            limit: input.limit
        });
    }

    async #assertReadable(trajectoryId: string, userId?: string): Promise<Trajectory> {
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

        if (!trajectory) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        if (trajectory.isPublic) {
            return trajectory;
        }

        if (!userId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 'Team membership required to access this trajectory');
        }

        const isMember = await TeamMember.existsBy({
            team: trajectory.team,
            user: userId
        });
        if (!isMember) {
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
    }): Promise<Trajectory> {
        const { frames, ...rest } = data;
        const trajectory = await Trajectory.create(rest as DeepPartial<Trajectory>).save();

        if (frames && frames.length > 0) {
            await this.#replaceFrames(trajectory.id, frames);
        }

        return trajectory;
    }

    async #deleteTrajectoryById(id: string): Promise<boolean> {
        const trajectory = await Trajectory.findOneBy({ id });
        if (!trajectory) {
            return false;
        }

        await trajectory.remove();
        return true;
    }

    #toTrajectoryOutput(trajectory: Trajectory): Record<string, unknown> {
        return trajectory.toJSON();
    }

    #toBootstrapTrajectory(trajectory: Trajectory, frames: TrajectoryFrame[]): PublicCanvasBootstrapTrajectoryView {
        return {
            _id: trajectory.id,
            name: trajectory.name,
            status: trajectory.status,
            isPublic: trajectory.isPublic,
            teamId: trajectory.team,
            analysisIds: [],
            frames: frames.map((frame) => ({
                timestep: frame.timestep,
                natoms: frame.natoms,
                simulationCell: (typeof frame.simulationCell === 'string'
                    ? frame.simulationCell
                    : frame.simulationCell?._id) ?? ''
            }))
        };
    }

    async #createDashboardPreviewOutput(buffer: Buffer): Promise<GetTrajectoryPreviewOutput> {
        const resized = await sharp(buffer)
            .resize(DASHBOARD_PREVIEW_MAX_WIDTH, DASHBOARD_PREVIEW_MAX_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .png({ compressionLevel: 9 })
            .toBuffer();

        const etag = `"${createHash('sha256').update(resized).digest('hex')}"`;
        return {
            base64: `data:image/png;base64,${resized.toString('base64')}`,
            etag
        };
    }

    #createCanvasPreviewOutput(buffer: Buffer): GetTrajectoryPreviewOutput {
        const etag = `"${createHash('sha256').update(buffer).digest('hex')}"`;
        return {
            base64: `data:image/png;base64,${buffer.toString('base64')}`,
            etag
        };
    }

    async #resolveDestinationStorageClusterId(teamId: string, requestedClusterId?: string): Promise<string> {
        if (!requestedClusterId) {
            return this.#clusterSelection.resolveStorageClusterId(teamId);
        }

        const requestedCluster = await TeamCluster.findOneBy({ id: requestedClusterId });
        if (!requestedCluster || requestedCluster.team !== teamId) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found for the requested team');
        }

        if (requestedCluster.status !== TeamClusterStatus.Connected) {
            throw ApplicationError.conflict(
                'TeamCluster::StorageClusterRequired',
                'A connected storage-capable team cluster is required for this operation'
            );
        }

        const requestedCapabilities = resolveEffectiveCapabilitiesFromRoleConfig(requestedCluster.roleConfig);
        if (requestedCapabilities.acceptsStorageWrites) {
            return requestedCluster.id;
        }

        return this.#clusterSelection.resolveStorageClusterId(teamId, undefined, requestedCluster.id);
    }

    #validateUploadSession(
        session: { status: string; expiresAt: Date; team: string; user: string; resourceKind: string },
        input: CommitTrajectoryUploadSessionInput
    ): ApplicationError | null {
        if (session.status !== TrajectoryUploadSessionStatus.Pending) {
            return ApplicationError.conflict('TrajectoryUploadSession::NotPending', 'Upload session is not pending');
        }
        if (session.expiresAt.getTime() <= Date.now()) {
            return ApplicationError.badRequest('TrajectoryUploadSession::Expired', 'Upload session has expired');
        }
        if (session.team !== input.teamId || session.user !== input.userId) {
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

        const cells = await insertSimulationCells(cellItems as never);

        let cellIndex = 0;
        return frames.map((frame) => ({
            timestep: frame.timestep,
            natoms: frame.natoms,
            simulationCell: frame.simulationCell ? cells[cellIndex++]._id : undefined
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
        input: DownloadTrajectoryInput,
        trajectoryName: string | undefined,
        teamClusterId: string,
        timesteps: string[]
    ): Promise<DownloadTrajectoryOutput> {
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

    async #buildAnalysisArchiveEntry(analysisId: string, teamId: string): Promise<ClusterArchiveObjectEntry | null> {
        let exportArtifact: DownloadStreamOutput;

        try {
            exportArtifact = await this.#pluginService.getPluginExposureExport({
                analysisId,
                teamId
            });
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return null;
            }
            throw error;
        }

        await exportArtifact.prepare?.();

        const candidate = exportArtifact as DownloadStreamOutput & { clusterObject?: ClusterArchiveReference };
        const clusterObject = candidate.clusterObject ?? null;
        exportArtifact.stream.destroy();
        if (!clusterObject) {
            return null;
        }

        const filename = readFilenameFromContentDisposition(exportArtifact.headers['Content-Disposition'])
            || readFilenameFromContentDisposition(exportArtifact.headers['content-disposition'])
            || `AnalysisID-${analysisId}.zip`;

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
    ): GetAtomsColumnarOutput {
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
            {
                name: ID_PROPERTY_NAME,
                dtype: 'u32',
                buffer: new Uint8Array(idBuffer)
            },
            {
                name: TYPE_PROPERTY_NAME,
                dtype: 'u32',
                buffer: new Uint8Array(typeBuffer)
            },
            {
                name: 'x',
                dtype: 'f32',
                buffer: new Uint8Array(xBuffer)
            },
            {
                name: 'y',
                dtype: 'f32',
                buffer: new Uint8Array(yBuffer)
            },
            {
                name: 'z',
                dtype: 'f32',
                buffer: new Uint8Array(zBuffer)
            }
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
                stringColumns.push({
                    name: prop,
                    dtype: 'str',
                    buffer
                });
                continue;
            }
            const buffer = new ArrayBuffer(values.length * Float32Array.BYTES_PER_ELEMENT);
            new Float32Array(buffer).set(values.map((value) => (
                typeof value === 'number' ? value : Number(value ?? Number.NaN)
            )) as ArrayLike<number>);
            columns.push({
                name: prop,
                dtype: 'f32',
                buffer: new Uint8Array(buffer)
            });
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

    #toSceneArtifactOutput(artifact: SceneArtifact): Record<string, unknown> {
        return artifact.toJSON();
    }

    async #listTrajectorySceneArtifacts(input: ListTrajectorySceneArtifactsInput): Promise<PaginatedResult<unknown>> {
        const { trajectoryId, sourceType, analysisId, projection, timestep } = input;
        const parsedTimestep = timestep !== undefined ? Number(timestep) : undefined;

        const where: FindOptionsWhere<SceneArtifact> = { trajectory: trajectoryId };
        if (sourceType) where.sourceType = sourceType;
        if (analysisId) where.analysis = analysisId;
        if (parsedTimestep !== undefined) where.timestep = parsedTimestep;

        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: SCENE_ARTIFACT_LIST_DEFAULT_LIMIT });

        const [artifacts, total] = await SceneArtifact.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        const result = paginate(
            [artifacts.map((artifact) => this.#toSceneArtifactOutput(artifact)), total],
            pageRequest
        );

        if (sourceType === 'plugin-exposure' && projection === 'renderable-exposures') {
            const data = this.#projectRenderableExposures(artifacts);
            return {
                ...result,
                total: data.length,
                data
            };
        }

        return result;
    }

    #projectRenderableExposures(artifacts: SceneArtifact[]) {
        const byExposureId = new Map<string, SceneArtifact>();

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
                return Boolean(artifact.plugin)
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

    #presentFolder(folder: CatalogFolder): TrajectoryFolderView {
        return {
            _id: folder.id,
            title: folder.title,
            parent: folder.parent ? String(folder.parent) : null,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt
        };
    }

    async #deleteFolderTree(teamId: string, folderId: string): Promise<void> {
        const subfolders = await CatalogFolder.findBy({
            team: teamId,
            parent: folderId,
            kind: CatalogFolderKind.Trajectory
        });
        for (const subfolder of subfolders) {
            await this.#deleteFolderTree(teamId, subfolder.id);
        }

        const trajectories = await Trajectory.find({
            where: {
                team: teamId,
                folder: folderId
            },
            select: { id: true }
        });
        for (const trajectory of trajectories) {
            await this.deleteById({
                trajectoryId: trajectory.id,
                teamId
            });
        }

        await CatalogFolder.delete({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Trajectory
        });
    }

    async #getFrames(trajectoryId: string): Promise<TrajectoryFrame[]> {
        return getTrajectoryFrames(trajectoryId);
    }

    async #replaceFrames(trajectoryId: string, frames: TrajectoryFrame[]): Promise<void> {
        const dataSource = TrajectoryFrameEntity.getRepository().manager.connection;

        await dataSource.transaction(async (manager) => {
            await manager.delete(TrajectoryFrameEntity, { trajectoryId });

            const rows = this.#buildFrameRows(trajectoryId, frames);
            if (rows.length === 0) return;

            await manager.createQueryBuilder()
                .insert()
                .into(TrajectoryFrameEntity)
                .values(rows)
                .orIgnore()
                .execute();
        });
    }

    #buildFrameRows(trajectoryId: string, frames: TrajectoryFrame[]): QueryDeepPartialEntity<TrajectoryFrameEntity>[] {
        return frames.map((frame) => {
            const cellId = typeof frame.simulationCell === 'string'
                ? frame.simulationCell
                : frame.simulationCell?._id;

            return {
                id: generateEntityId(),
                trajectoryId,
                timestep: frame.timestep,
                natoms: frame.natoms,
                simulationCell: cellId ?? null
            };
        });
    }

    async #getFrameListingSummaries(
        trajectoryIds: string[]
    ): Promise<Map<string, { framesCount: number; atoms: number; firstTimestep: number }>> {
        const summaries = new Map<string, { framesCount: number; atoms: number; firstTimestep: number }>();
        if (trajectoryIds.length === 0) return summaries;

        const counts = await TrajectoryFrameEntity.createQueryBuilder('frame')
            .select('frame.trajectoryId', 'trajectoryId')
            .addSelect('COUNT(frame.id)', 'framesCount')
            .addSelect('MIN(frame.timestep)', 'firstTimestep')
            .where('frame.trajectoryId IN (:...trajectoryIds)', { trajectoryIds })
            .groupBy('frame.trajectoryId')
            .getRawMany<{ trajectoryId: string; framesCount: string | number; firstTimestep: string | number }>();

        if (counts.length === 0) return summaries;

        const firstFrames = await TrajectoryFrameEntity.createQueryBuilder('frame')
            .select('frame.trajectoryId', 'trajectoryId')
            .addSelect('frame.natoms', 'natoms')
            .where('frame.trajectoryId IN (:...trajectoryIds)', { trajectoryIds })
            .andWhere(
                'frame.timestep = (SELECT MIN(earliest.timestep) FROM trajectory_frames earliest'
                + ' WHERE earliest.trajectoryId = frame.trajectoryId)'
            )
            .getRawMany<{ trajectoryId: string; natoms: string | number }>();

        const atomsByTrajectory = new Map<string, number>();
        for (const row of firstFrames) {
            const trajectoryId = String(row.trajectoryId);
            if (atomsByTrajectory.has(trajectoryId)) continue;
            atomsByTrajectory.set(trajectoryId, Number(row.natoms));
        }

        for (const row of counts) {
            const trajectoryId = String(row.trajectoryId);
            summaries.set(trajectoryId, {
                framesCount: Number(row.framesCount),
                atoms: atomsByTrajectory.get(trajectoryId) ?? 0,
                firstTimestep: Number(row.firstTimestep)
            });
        }

        return summaries;
    }
}
