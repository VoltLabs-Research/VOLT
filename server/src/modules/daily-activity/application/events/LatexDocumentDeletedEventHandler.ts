import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import LatexDocumentDeletedEvent from '@modules/latex/domain/events/LatexDocumentDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('latex-document.deleted')
export default class LatexDocumentDeletedEventHandler implements IEventHandler<LatexDocumentDeletedEvent> {
    constructor(
        private activityRepo: DailyActivityRepository
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
}
