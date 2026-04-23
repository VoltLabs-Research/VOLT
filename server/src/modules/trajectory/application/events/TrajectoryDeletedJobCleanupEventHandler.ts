import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import type TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedJobCleanupEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        
        private readonly teamJobMaintenanceService: TeamJobMaintenanceService
    ) {}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { teamId, trajectoryId } = event.payload;
        if (!teamId) {
            return;
        }

        try {
            await this.teamJobMaintenanceService.removeJobsForTrajectory(teamId, trajectoryId);
        } catch (error) {
            logger.warn(
                error,
                `[TrajectoryDeletedJobCleanupEventHandler] Failed to cancel running jobs for trajectory ${trajectoryId}`
            );
        }
    }
};
