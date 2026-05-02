import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('analysis.deleted')
export default class AnalysisDeletedEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        private activityRepo: DailyActivityRepository
    ) {}

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { teamId, userId, pluginDisplayName } = event.payload;
        if (!teamId || !userId) return;
        const description = `Deleted analysis "${pluginDisplayName}"`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.AnalysisDeletion,
            description
        );
    }
}
