import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import LatexDocumentDeletedEvent from '@modules/latex/domain/events/LatexDocumentDeletedEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class LatexDocumentDeletedEventHandler implements IEventHandler<LatexDocumentDeletedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
    ) {}

    async handle(event: LatexDocumentDeletedEvent): Promise<void> {
        const { teamId, userId, documentTitle } = event.payload;
        if (!teamId || !userId) return;
        const description = `Deleted LaTeX document "${documentTitle}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.LatexDocumentDeletion,
            description
        );
    }
};
