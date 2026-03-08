import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class TrajectoryCreatedEventHandler implements IEventHandler<TrajectoryCreatedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
    ) {}

    async handle(event: TrajectoryCreatedEvent): Promise<void> {
        const { teamId, userId, trajectoryName } = event.payload;
        if (!teamId || !userId) return;
        const description = `Uploaded trajectory "${trajectoryName}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.TrajectoryUpload,
            description
        );
    }
};
