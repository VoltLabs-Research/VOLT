import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import WhiteboardDeletedEvent from '@modules/whiteboards/domain/events/WhiteboardDeletedEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class WhiteboardDeletedEventHandler implements IEventHandler<WhiteboardDeletedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
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
