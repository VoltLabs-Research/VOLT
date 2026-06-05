import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import type { ITeamJobMaintenanceService } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import type TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedJobCleanupEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(JOBS_TOKENS.TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: ITeamJobMaintenanceService
    ) {}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { teamId, trajectoryId } = event.payload;
        if (!teamId) {
            return;
        }

        try {
            await this.teamJobMaintenanceService.cleanupDeletedTrajectory(event.payload);
        } catch (error) {
            logger.warn(
                error,
                `[TrajectoryDeletedJobCleanupEventHandler] Failed to purge runtime state for trajectory ${trajectoryId}`
            );
        }
    }
}
