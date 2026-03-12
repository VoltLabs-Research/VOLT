import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import LatexDocumentCreatedEvent from '@modules/latex/domain/events/LatexDocumentCreatedEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class LatexDocumentCreatedEventHandler implements IEventHandler<LatexDocumentCreatedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
    ) {}

    async handle(event: LatexDocumentCreatedEvent): Promise<void> {
        const { teamId, userId, documentTitle } = event.payload;
        if (!teamId || !userId) return;
        const description = `Created LaTeX document "${documentTitle}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.LatexDocumentCreation,
            description
        );
    }
};
