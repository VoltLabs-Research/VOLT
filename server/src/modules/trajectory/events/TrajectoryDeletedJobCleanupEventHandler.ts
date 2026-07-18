import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import type TrajectoryDeletedEvent from '@modules/trajectory/events/trajectory/TrajectoryDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';
import logger from '@shared/infrastructure/logger';

class TrajectoryDeletedJobCleanupEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { teamId, trajectoryId } = event.payload;
        if (!teamId) {
            return;
        }

        try {
            await teamJobMaintenanceService.cleanupDeletedTrajectory(event.payload);
        } catch (error) {
            logger.warn(
                error,
                `[TrajectoryDeletedJobCleanupEventHandler] Failed to purge runtime state for trajectory ${trajectoryId}`
            );
        }
    }
}

const trajectoryDeletedJobCleanupEventHandler = new TrajectoryDeletedJobCleanupEventHandler();
subscribeHandler('trajectory.deleted', trajectoryDeletedJobCleanupEventHandler);

export default trajectoryDeletedJobCleanupEventHandler;
