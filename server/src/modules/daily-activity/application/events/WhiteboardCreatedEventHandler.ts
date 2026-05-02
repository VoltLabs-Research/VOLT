import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import WhiteboardCreatedEvent from '@modules/whiteboards/domain/events/WhiteboardCreatedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('whiteboard.created')
export default class WhiteboardCreatedEventHandler implements IEventHandler<WhiteboardCreatedEvent> {
    constructor(
        private activityRepo: DailyActivityRepository
    ) {}

    async handle(event: WhiteboardCreatedEvent): Promise<void> {
        const { teamId, userId, whiteboardTitle } = event.payload;
        if (!teamId || !userId) return;
        const description = `Created whiteboard "${whiteboardTitle}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.WhiteboardCreation,
            description
        );
    }
}
