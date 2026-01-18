import { IEventHandler } from '@shared/application/events/IEventHandler';
import SessionCompletedEvent from '@modules/jobs/application/events/SessionCompletedEvent';
import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/Trajectory';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { IRasterService } from '@modules/raster/domain/ports/IRasterService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TrajectoryUpdatedEvent from './TrajectoryUpdatedEvent';

@injectable()
export default class SessionCompletedEventHandler implements IEventHandler<SessionCompletedEvent> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(RASTER_TOKENS.RasterService)
        private readonly rasterService: IRasterService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async handle(event: SessionCompletedEvent): Promise<void> {
        const { queueType, metadata } = event.data;

        if (queueType === 'trajectory_processing') {
            const { trajectoryId } = metadata || {};
            // Safety check for trajectoryId
            if (!trajectoryId) {
                console.error('[SessionCompletedEventHandler] Missing trajectoryId in metadata');
                return;
            }

            console.log(`[SessionCompletedEventHandler] Trajectory processing completed for ${trajectoryId}. Triggering rasterization.`);

            try {
                // Trigger rasterization for previews - pass teamId so jobs have correct teamId
                const rasterizationTriggered = await this.rasterService.triggerRasterization(trajectoryId, event.data.teamId);

                if (!rasterizationTriggered) {
                    // No GLB files to rasterize, mark trajectory as completed immediately
                    console.log(`[SessionCompletedEventHandler] No rasterization needed for ${trajectoryId}. Marking as completed.`);
                    await this.trajectoryRepo.updateById(trajectoryId, { status: TrajectoryStatus.Completed });

                    await this.eventBus.publish(new TrajectoryUpdatedEvent({
                        trajectoryId,
                        teamId: event.data.teamId,
                        updates: {
                            status: TrajectoryStatus.Completed
                        },
                        updatedAt: new Date()
                    }));
                }
                // If rasterization was triggered, status will be updated when rasterizer queue completes
            } catch (error) {
                console.error(`[SessionCompletedEventHandler] Failed to trigger rasterization for ${trajectoryId}:`, error);
                await this.trajectoryRepo.updateById(trajectoryId, { status: TrajectoryStatus.Failed });

                await this.eventBus.publish(new TrajectoryUpdatedEvent({
                    trajectoryId,
                    teamId: event.data.teamId,
                    updates: {
                        status: TrajectoryStatus.Failed
                    },
                    updatedAt: new Date()
                }));
            }
        } else if (queueType === 'rasterizer') {
            const { trajectoryId } = metadata || {};
            if (!trajectoryId) {
                console.error('[SessionCompletedEventHandler] Missing trajectoryId in rasterizer metadata');
                return;
            }

            console.log(`[SessionCompletedEventHandler] Rasterization completed for ${trajectoryId}. Marking as completed.`);

            await this.trajectoryRepo.updateById(trajectoryId, { status: TrajectoryStatus.Completed });

            await this.eventBus.publish(new TrajectoryUpdatedEvent({
                trajectoryId,
                teamId: event.data.teamId,
                updates: {
                    status: TrajectoryStatus.Completed
                },
                updatedAt: new Date()
            }));
        } else {
            console.log(`[SessionCompletedEventHandler] Ignoring session completion for queueType: ${queueType}`);
        }
    }
}
