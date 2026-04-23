import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import WhiteboardDeletedEvent from '@modules/whiteboards/domain/events/WhiteboardDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('whiteboard.deleted')
export default class WhiteboardDeletedEventHandler implements IEventHandler<WhiteboardDeletedEvent> {
    constructor(
        
        private activityRepo: DailyActivityRepository
    ) {}

    async handle(event: WhiteboardDeletedEvent): Promise<void> {
        const { teamId, userId, whiteboardTitle } = event.payload;
        if (!teamId || !userId) return;
        const description = `Deleted whiteboard "${whiteboardTitle}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.WhiteboardDeletion,
            description
        );
    }
};
