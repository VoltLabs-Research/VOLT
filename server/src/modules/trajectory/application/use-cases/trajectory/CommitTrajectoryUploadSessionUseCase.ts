import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import ClusterObjectUploadSessionRepository from '@modules/cluster-object/infrastructure/persistence/mongo/repositories/ClusterObjectUploadSessionRepository';
import DaemonAnalysisCompletionService from '@modules/cluster/infrastructure/services/DaemonAnalysisCompletionService';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';

import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { TrajectoryFrame } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type {
    CommitTrajectoryUploadSessionInputDTO,
    CommitTrajectoryUploadSessionOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/TrajectoryUploadSessionDTO';
import type { ClusterObjectUploadSessionDocument } from '@modules/cluster-object/infrastructure/persistence/mongo/models/ClusterObjectUploadSessionModel';

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

@injectable()
export default class CommitTrajectoryUploadSessionUseCase implements IUseCase<
    CommitTrajectoryUploadSessionInputDTO,
    CommitTrajectoryUploadSessionOutputDTO,
    ApplicationError
> {
    constructor(
        private readonly uploadSessionRepository: ClusterObjectUploadSessionRepository,
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        private readonly trajectoryRepo: TrajectoryRepository,
        private readonly simulationCellRepo: SimulationCellRepository,
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: CommitTrajectoryUploadSessionInputDTO): Promise<Result<CommitTrajectoryUploadSessionOutputDTO, ApplicationError>> {
        const session = await this.uploadSessionRepository.findById(input.uploadSessionId);
        if (!session) {
            return Result.fail(ApplicationError.notFound(
                'ClusterObjectUploadSession::NotFound',
                'Upload session not found'
            ));
        }

        const trajectoryId = session.resourceId.toString();

        if (session.status === 'committed') {
            return Result.ok({ trajectoryId });
        }

        const validationError = this.validateSession(session, input);
        if (validationError) {
            return Result.fail(validationError);
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
                // Disable command timeout: large ingest/materialization can
                // exceed 60s and should not fail the trajectory commit.
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

            return Result.ok({ trajectoryId });
        } catch (error) {
            logger.error(error, `[CommitTrajectoryUploadSessionUseCase] Commit failed for uploadSessionId=${session.id}`);
            await this.uploadSessionRepository.markStatus(session.id, 'failed').catch(() => {});
            await this.trajectoryRepo.updateById(trajectoryId, { status: TrajectoryStatus.Failed }).catch(() => {});
            await this.eventBus.publish(new TrajectoryUpdatedEvent({
                trajectoryId,
                teamId: input.teamId,
                updates: { status: TrajectoryStatus.Failed },
                updatedAt: new Date()
            })).catch(() => {});
            throw error;
        }
    }

    private validateSession(
        session: ClusterObjectUploadSessionDocument,
        input: CommitTrajectoryUploadSessionInputDTO
    ): ApplicationError | null {
        if (session.status !== 'pending') {
            return ApplicationError.conflict(
                'ClusterObjectUploadSession::NotPending',
                'Upload session is not pending'
            );
        }

        if (session.expiresAt.getTime() <= Date.now()) {
            return ApplicationError.badRequest(
                'ClusterObjectUploadSession::Expired',
                'Upload session has expired'
            );
        }

        if (session.team.toString() !== input.teamId || session.user.toString() !== input.userId) {
            return ApplicationError.forbidden(
                'ClusterObjectUploadSession::Forbidden',
                'Upload session does not belong to this user and team'
            );
        }

        if (session.resourceKind !== 'trajectory') {
            return ApplicationError.badRequest(
                'ClusterObjectUploadSession::UnsupportedResource',
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
                `[CommitTrajectoryUploadSessionUseCase] Failed to persist simulation cell trajectoryId=${trajectoryId} timestep=${timestep}`
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
