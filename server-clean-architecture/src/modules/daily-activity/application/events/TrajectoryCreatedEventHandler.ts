import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { IDailyActivityRepository } from '@modules/daily-activity/domain/ports/IDailyActivityRepository';
import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/TrajectoryCreatedEvent';

@injectable()
export default class TrajectoryCreatedEventHandler implements IEventHandler<TrajectoryCreatedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
    ) {}

    async handle(event: TrajectoryCreatedEvent): Promise<void> {
        const payload = event.payload || (event as any);
        const { teamId, userId, trajectoryName } = payload;
        if (!teamId || !userId) return;
        const description = `Uploaded trajectory "${trajectoryName}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.TrajectoryUpload,
            description
        );
    }
}
