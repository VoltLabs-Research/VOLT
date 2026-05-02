import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('trajectory.created')
export default class TrajectoryCreatedEventHandler implements IEventHandler<TrajectoryCreatedEvent> {
    constructor(
        private activityRepo: DailyActivityRepository
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
}
