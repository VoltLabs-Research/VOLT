import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        private activityRepo: DailyActivityRepository
    ) {}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { teamId, userId, trajectoryName } = event.payload;
        if (!teamId || !userId) return;
        const description = `Deleted trajectory "${trajectoryName}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.TrajectoryDeletion,
            description
        );
    }
}
