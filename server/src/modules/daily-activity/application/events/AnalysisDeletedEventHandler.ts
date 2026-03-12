import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class AnalysisDeletedEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
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
};
