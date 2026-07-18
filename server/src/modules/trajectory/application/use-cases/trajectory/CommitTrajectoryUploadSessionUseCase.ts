import { CLUSTER_SERVICE_TOKENS, SIMULATION_CELL_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import type { ITrajectoryUploadSessionRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryUploadSessionRepository';
import type { ISimulationCellRepository } from '@shared/contracts/ports';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import type { IDaemonAnalysisCompletionService } from '@shared/contracts/ports';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import type { TrajectoryUploadSession } from '@modules/trajectory/domain/contracts/trajectory/UploadSession';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';

import type { SimulationCellProps } from '@shared/contracts/types';
import type { TrajectoryFrame } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type {
    CommitTrajectoryUploadSessionInputDTO,
    CommitTrajectoryUploadSessionOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/TrajectoryUploadSessionDTO';

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

const GLB_QUEUE_TYPE = 'trajectory_glb_conversion';
const GLB_JOB_NAME = 'Preprocess trajectory frame';

const isNoValidFramesError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : '';
    return /no valid trajectory frames/i.test(message);
};

@injectable()
export default class CommitTrajectoryUploadSessionUseCase implements IUseCase<
    CommitTrajectoryUploadSessionInputDTO,
    CommitTrajectoryUploadSessionOutputDTO
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryUploadSessionRepository) private readonly uploadSessionRepository: ITrajectoryUploadSessionRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly teamClusterDaemonClient: ITeamClusterDaemonClient,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepo: ITrajectoryRepository,
        @inject(SIMULATION_CELL_CONTRACT_TOKENS.SimulationCellRepository) private readonly simulationCellRepo: ISimulationCellRepository,
        @inject(CLUSTER_SERVICE_TOKENS.DaemonAnalysisCompletionService)
        private readonly daemonAnalysisCompletionService: IDaemonAnalysisCompletionService,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: CommitTrajectoryUploadSessionInputDTO): Promise<CommitTrajectoryUploadSessionOutputDTO> {
        const session = await this.uploadSessionRepository.findById(input.uploadSessionId);
        if (!session) {
            throw ApplicationError.notFound(
                'TrajectoryUploadSession::NotFound',
                'Upload session not found'
            );
        }

        const trajectoryId = session.resourceId.toString();

        if (session.status === 'committed') {
            return { trajectoryId };
        }

        const validationError = this.validateSession(session, input);
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

            const result = await this.teamClusterDaemonClient.command<TrajectoryIngestResult>(
                session.ownerClusterId.toString(),
                ChannelCommands.TrajectoryIngest,
                {
                    trajectoryId,
                    teamId: input.teamId,
                    stagedObjects
                },
                { timeoutMs: 0 }
            );

            const trajectory = await this.trajectoryRepo.findById(trajectoryId);
            const trajectoryName = trajectory?.props.name || 'Trajectory';
            const frames = await this.buildPersistableFrames(trajectoryId, input.teamId, result.frames);

            await this.trajectoryRepo.updateById(trajectoryId, {
                status: TrajectoryStatus.Processing,
                stats: result.stats,
                frames
            });

            await this.daemonAnalysisCompletionService.initializeGlbSession(
                trajectoryId,
                frames.length,
                input.teamId
            );

            await this.daemonAnalysisCompletionService.handleQueuedJobs(
                this.buildQueuedGlbJobs(trajectoryId, trajectoryName, input.teamId, frames),
                'glb',
                session.ownerClusterId.toString()
            ).catch((projectionError) => {
                logger.warn(
                    projectionError,
                    `[CommitTrajectoryUploadSessionUseCase] Failed to project queued GLB jobs for ${trajectoryId}`
                );
            });

            await this.uploadSessionRepository.markStatus(session.id, 'committed', { committedAt: new Date() });
            await this.eventBus.publish(new TrajectoryUpdatedEvent({
                trajectoryId,
                teamId: input.teamId,
                updates: {
                    status: TrajectoryStatus.Processing,
                    stats: result.stats
                },
                updatedAt: new Date()
            }));

            return { trajectoryId };
        } catch (error) {
            logger.error(error, `[CommitTrajectoryUploadSessionUseCase] Commit failed for uploadSessionId=${session.id}`);
            await this.uploadSessionRepository.markStatus(session.id, 'failed').catch(() => {});
            const trajectory = await this.trajectoryRepo.findById(trajectoryId).catch(() => null);
            await this.trajectoryRepo.deleteById(trajectoryId).catch((deleteError) => {
                logger.warn(deleteError, `[CommitTrajectoryUploadSessionUseCase] Failed to delete orphaned trajectory ${trajectoryId}`);
            });
            await this.eventBus.publish(new TrajectoryDeletedEvent({
                trajectoryId,
                teamId: input.teamId,
                storageClusterId: trajectory ? resolveTrajectoryStorageClusterId(trajectory.props) : undefined,
                userId: input.userId ?? '',
                trajectoryName: trajectory?.props.name ?? 'Trajectory',
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

    private validateSession(
        session: TrajectoryUploadSession,
        input: CommitTrajectoryUploadSessionInputDTO
    ): ApplicationError | null {
        if (session.status !== 'pending') {
            return ApplicationError.conflict(
                'TrajectoryUploadSession::NotPending',
                'Upload session is not pending'
            );
        }

        if (session.expiresAt.getTime() <= Date.now()) {
            return ApplicationError.badRequest(
                'TrajectoryUploadSession::Expired',
                'Upload session has expired'
            );
        }

        if (session.team.toString() !== input.teamId || session.user.toString() !== input.userId) {
            return ApplicationError.forbidden(
                'TrajectoryUploadSession::Forbidden',
                'Upload session does not belong to this user and team'
            );
        }

        if (session.resourceKind !== 'trajectory') {
            return ApplicationError.badRequest(
                'TrajectoryUploadSession::UnsupportedResource',
                'Upload session is not a trajectory upload'
            );
        }

        return null;
    }

    private async buildPersistableFrames(
        trajectoryId: string,
        teamId: string,
        frames: TrajectoryIngestResult['frames']
    ): Promise<TrajectoryFrame[]> {
        const cellItems = frames
            .filter((frame) => frame.simulationCell)
            .map((frame) => ({
                ...frame.simulationCell!,
                team: teamId,
                trajectory: trajectoryId,
                timestep: frame.timestep
            }));

        const cells = await this.simulationCellRepo.createMany(cellItems);

        let cellIndex = 0;
        return frames.map((frame) => ({
            timestep: frame.timestep,
            natoms: frame.natoms,
            simulationCell: frame.simulationCell ? cells[cellIndex++]._id : undefined
        }));
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
