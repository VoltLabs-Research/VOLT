import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import LatexDocumentCreatedEvent from '@modules/latex/domain/events/LatexDocumentCreatedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('latex-document.created')
export default class LatexDocumentCreatedEventHandler implements IEventHandler<LatexDocumentCreatedEvent> {
    constructor(
        
        private activityRepo: DailyActivityRepository
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
