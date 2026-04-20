import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { inject, injectable } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { ITeamJobMaintenanceService } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import type TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';

@injectable()
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
            await this.teamJobMaintenanceService.removeJobsForTrajectory(teamId, trajectoryId);
        } catch (error) {
            logger.warn(
                error,
                `[TrajectoryDeletedJobCleanupEventHandler] Failed to cancel running jobs for trajectory ${trajectoryId}`
            );
        }
    }
};
