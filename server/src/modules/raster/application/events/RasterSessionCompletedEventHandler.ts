import { injectable, inject } from 'tsyringe';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/Trajectory';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/TrajectoryUpdatedEvent';
import SessionCompletedEvent from '@modules/jobs/application/events/SessionCompletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import type { IRasterJobEnqueuer } from '@modules/raster/domain/port/IRasterJobEnqueuer';

@injectable()
export class RasterSessionCompletedEventHandler implements IEventHandler<SessionCompletedEvent> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(RASTER_TOKENS.RasterJobEnqueuer)
        private readonly rasterJobEnqueuer: IRasterJobEnqueuer,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async handle(event: SessionCompletedEvent): Promise<void> {
        try {
            const { queueType, metadata, teamId, failureSummary } = event.payload;

            if (queueType === 'trajectory_processing') {
                await this.handleTrajectoryProcessingCompletion(
                    metadata?.trajectoryId as string | undefined,
                    teamId,
                    (failureSummary?.failedJobs || 0) > 0,
                    failureSummary?.lastFailure
                );
                return;
            }

            if (queueType === 'rasterizer') {
                await this.handleRasterizationCompletion(
                    metadata?.trajectoryId as string | undefined,
                    teamId,
                    (failureSummary?.failedJobs || 0) > 0,
                    failureSummary?.lastFailure
                );
            }
        } catch (error) {
            logger.error(
                error,
                `[RasterSessionCompletedEventHandler] Unhandled error in handle() for event: ${JSON.stringify(event.payload?.metadata)}`
            );
        }
    }

    private async handleTrajectoryProcessingCompletion(
        trajectoryId: string | undefined,
        teamId: string,
        hasSessionFailures: boolean,
        lastFailure: unknown
    ): Promise<void> {
        if (!trajectoryId) {
            logger.error('[RasterSessionCompletedEventHandler] Missing trajectoryId in metadata');
            return;
        }

        if (hasSessionFailures) {
            logger.error(
                lastFailure,
                `[RasterSessionCompletedEventHandler] Trajectory processing failed for ${trajectoryId}`
            );
            await this.updateTrajectoryStatus(trajectoryId, teamId, TrajectoryStatus.Failed);
            return;
        }

        logger.info(`[RasterSessionCompletedEventHandler] Trajectory processing completed for ${trajectoryId}. Triggering rasterization.`);

        try {
            const rasterizationTriggered = await this.rasterJobEnqueuer.triggerRasterization(trajectoryId, teamId);

            if (!rasterizationTriggered) {
                logger.info(`[RasterSessionCompletedEventHandler] No rasterization needed for ${trajectoryId}. Marking as completed.`);
                await this.updateTrajectoryStatus(trajectoryId, teamId, TrajectoryStatus.Completed);
            }
        } catch (error) {
            logger.error(error, `[RasterSessionCompletedEventHandler] Failed to trigger rasterization for ${trajectoryId}`);
            await this.updateTrajectoryStatus(trajectoryId, teamId, TrajectoryStatus.Failed);
        }
    }

    private async handleRasterizationCompletion(
        trajectoryId: string | undefined,
        teamId: string,
        hasSessionFailures: boolean,
        lastFailure: unknown
    ): Promise<void> {
        if (!trajectoryId) {
            logger.error('[RasterSessionCompletedEventHandler] Missing trajectoryId in rasterizer metadata');
            return;
        }

        if (hasSessionFailures) {
            logger.error(
                lastFailure,
                `[RasterSessionCompletedEventHandler] Rasterization failed for ${trajectoryId}`
            );
            await this.updateTrajectoryStatus(trajectoryId, teamId, TrajectoryStatus.Failed);
            return;
        }

        logger.info(`[RasterSessionCompletedEventHandler] Rasterization completed for ${trajectoryId}. Marking as completed.`);
        await this.updateTrajectoryStatus(trajectoryId, teamId, TrajectoryStatus.Completed);
    }

    private async updateTrajectoryStatus(
        trajectoryId: string,
        teamId: string,
        status: TrajectoryStatus
    ): Promise<void> {
        await this.trajectoryRepo.updateById(trajectoryId, { status });

        await this.eventBus.publish(new TrajectoryUpdatedEvent({
            trajectoryId,
            teamId,
            updates: {
                status
            },
            updatedAt: new Date()
        }));
    }
}
