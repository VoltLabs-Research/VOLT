import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import StoragePlacementService from '@modules/cluster/application/services/StoragePlacementService';
import DaemonAnalysisCompletionService from '@modules/cluster/infrastructure/services/DaemonAnalysisCompletionService';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO } from '@modules/trajectory/application/dtos/trajectory/CreateTrajectoryDTO';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { TrajectoryFrame } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';
import { inject, injectable } from 'tsyringe';

interface TrajectoryIngestResult {
    trajectoryId: string;
    frames: Array<{
        timestep: number;
        natoms: number;
        headers: string[];
        simulationCell: Pick<SimulationCellProps, 'boundingBox' | 'geometry'> | null;
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

interface StagedTrajectoryObject {
    objectKey: string;
    originalName: string;
    size: number;
}

const STAGING_UPLOAD_CONCURRENCY = readPositiveIntegerEnv('TRAJECTORY_STAGING_UPLOAD_CONCURRENCY', 1);
const BACKGROUND_TRAJECTORY_INGEST_CONCURRENCY = readPositiveIntegerEnv('TRAJECTORY_BACKGROUND_INGEST_CONCURRENCY', 1);
const GLB_QUEUE_TYPE = 'trajectory_glb_conversion';
const GLB_JOB_NAME = 'Preprocess trajectory frame';
const backgroundTrajectoryIngestLimit = pLimit(BACKGROUND_TRAJECTORY_INGEST_CONCURRENCY);

const resolveTrajectoryName = (
    requestedName: string | undefined,
    files: CreateTrajectoryInputDTO['files']
): string | null => {
    const normalizedRequestedName = requestedName?.trim();
    if (normalizedRequestedName) {
        return normalizedRequestedName;
    }

    const [firstFile] = files;
    if (!firstFile) {
        return null;
    }

    const originalName = firstFile.originalname?.trim();
    if (originalName) {
        return path.basename(originalName);
    }

    if (firstFile.path) {
        return path.basename(firstFile.path);
    }

    return null;
};

@injectable()
export default class CreateTrajectoryUseCase implements IUseCase<CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO, ApplicationError> {
    constructor(

        private readonly trajectoryRepo: TrajectoryRepository,


        private readonly trajectoryFolderRepository: TrajectoryFolderRepository,


        private readonly teamClusterSelectionService: TeamClusterSelectionService,


        private readonly storagePlacementService: StoragePlacementService,


        private readonly objectGatewayClient: TeamClusterObjectGatewayClient,


        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        
        private readonly simulationCellRepo: SimulationCellRepository,

        
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateTrajectoryInputDTO): Promise<Result<CreateTrajectoryOutputDTO, ApplicationError>> {
        const { teamId, userId, files } = input;
        const name = resolveTrajectoryName(input.name, files);

        if (!name) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'At least one uploaded trajectory file is required'
            ));
        }

        if (input.folderId) {
            const folder = await this.trajectoryFolderRepository.findByTeamAndFolderId(teamId, input.folderId);
            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Target trajectory folder not found'
                ));
            }
        }

        const storageClusterId = await this.teamClusterSelectionService.resolveStorageClusterId(
            teamId,
            input.teamClusterId
        );

        const ext = path.extname(name);
        const cleanName = ext ? name.slice(0, -ext.length) : name;

        const trajectory = await this.trajectoryRepo.create({
            name: cleanName,
            team: teamId,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: userId,
            status: TrajectoryStatus.Processing,
            stats: { totalFiles: 0, totalSize: 0 },
            analysis: [],
            rasterSceneViews: 0,
            hasPreview: false,
            isPublic: true,
            updatedAt: new Date(),
            createdAt: new Date()
        });

        await this.storagePlacementService.ensurePlacement('trajectory', trajectory.id);

        // Fire-and-forget: stream files to daemon object gateway, then dispatch ingest command
        backgroundTrajectoryIngestLimit(() =>
            this.processAsync(trajectory._id, cleanName, storageClusterId, teamId, files)
        ).catch(async (err) => {
            logger.error(err, `[CreateTrajectoryUseCase] Background processing failed for ${trajectory._id}`);
            await this.trajectoryRepo.updateById(trajectory._id, { status: TrajectoryStatus.Failed }).catch(() => {});
            await this.eventBus.publish(new TrajectoryUpdatedEvent({
                trajectoryId: trajectory._id,
                teamId,
                updates: { status: TrajectoryStatus.Failed },
                updatedAt: new Date()
            })).catch(() => {});
        });

        await this.eventBus.publish(new TrajectoryCreatedEvent({
            trajectoryId: trajectory._id,
            trajectoryName: name,
            teamId,
            userId
        }));

        return Result.ok(toPersistedOutput(trajectory));
    }

    private async processAsync(
        trajectoryId: string,
        trajectoryName: string,
        storageClusterId: string,
        teamId: string,
        files: CreateTrajectoryInputDTO['files']
    ): Promise<void> {
        const limit = pLimit(STAGING_UPLOAD_CONCURRENCY);
        const stagedObjects: StagedTrajectoryObject[] = new Array(files.length);

        try {
            const uploadResults = await Promise.allSettled(files.map((file, index) => limit(async () => {
                const originalName = file.originalname || 'upload';
                const objectKey = `trajectory-staging/${trajectoryId}/${index}-${path.basename(originalName)}`;
                const stat = await fs.stat(file.path);

                await this.putStagedObject(storageClusterId, {
                    filePath: file.path,
                    objectKey,
                    contentLength: stat.size,
                    contentType: file.mimetype || 'application/octet-stream'
                });

                stagedObjects[index] = { objectKey, originalName, size: stat.size };
            })));

            const rejectedUpload = uploadResults.find((result) => result.status === 'rejected');
            if (rejectedUpload?.status === 'rejected') {
                throw rejectedUpload.reason;
            }

            const result = await this.teamClusterDaemonClient.command<TrajectoryIngestResult>(
                storageClusterId,
                ChannelCommands.TrajectoryIngest,
                { trajectoryId, teamId, stagedObjects },
                { timeoutClass: 'long-running-control-plane' }
            );

            const frames = await this.buildPersistableFrames(trajectoryId, teamId, result.frames);

            await this.trajectoryRepo.updateById(trajectoryId, {
                status: TrajectoryStatus.Processing,
                stats: result.stats,
                frames
            });

            await this.daemonAnalysisCompletionService.initializeGlbSession(
                trajectoryId,
                frames.length,
                teamId
            );

            await this.daemonAnalysisCompletionService.handleQueuedJobs(
                this.buildQueuedGlbJobs(trajectoryId, trajectoryName, teamId, frames),
                'glb',
                storageClusterId
            ).catch((projectionError) => {
                logger.warn(
                    projectionError,
                    `[CreateTrajectoryUseCase] Failed to project queued GLB jobs for ${trajectoryId}`
                );
            });

            await this.eventBus.publish(new TrajectoryUpdatedEvent({
                trajectoryId,
                teamId,
                updates: {
                    status: TrajectoryStatus.Processing,
                    stats: result.stats
                },
                updatedAt: new Date()
            }));
        } finally {
            // Always clean up temp files regardless of success or failure
            await Promise.all(files.map((file) =>
                fs.unlink(file.path).catch(() => {})
            ));
        }
    }

    private async putStagedObject(
        storageClusterId: string,
        input: {
            filePath: string;
            objectKey: string;
            contentLength: number;
            contentType: string;
        }
    ): Promise<void> {
        await this.objectGatewayClient.putStream(storageClusterId, {
            bucket: SYS_BUCKETS.DUMPS,
            objectKey: input.objectKey,
            stream: createReadStream(input.filePath),
            contentLength: input.contentLength,
            contentType: input.contentType
        });
    }

    private async buildPersistableFrames(
        trajectoryId: string,
        teamId: string,
        frames: TrajectoryIngestResult['frames']
    ): Promise<TrajectoryFrame[]> {
        return Promise.all(frames.map(async (frame) => ({
            timestep: frame.timestep,
            natoms: frame.natoms,
            simulationCell: await this.createSimulationCell(
                trajectoryId,
                teamId,
                frame.timestep,
                frame.simulationCell
            )
        })));
    }

    private async createSimulationCell(
        trajectoryId: string,
        teamId: string,
        timestep: number,
        data: Pick<SimulationCellProps, 'boundingBox' | 'geometry'> | null
    ): Promise<string | undefined> {
        if (!data) return undefined;

        try {
            const cell = await this.simulationCellRepo.create({
                ...data,
                team: teamId,
                trajectory: trajectoryId,
                timestep
            });
            return cell._id;
        } catch (error) {
            logger.warn(
                error,
                `[CreateTrajectoryUseCase] Failed to persist simulation cell trajectoryId=${trajectoryId} timestep=${timestep}`
            );
            return undefined;
        }
    }

    private buildQueuedGlbJobs(
        trajectoryId: string,
        trajectoryName: string,
        teamId: string,
        frames: TrajectoryFrame[]
    ): QueuedGlbJob[] {
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
}
