import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { inject, injectable } from 'tsyringe';
import PluginExecutionRequestEvent from '@modules/plugin/domain/events/PluginExecutionRequestEvent';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class LogPluginExecutionRequestHandler implements IEventHandler<PluginExecutionRequestEvent>{
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
    ){}

    async handle(event: PluginExecutionRequestEvent): Promise<void>{
        const { pluginName, trajectoryName, teamId, userId } = event.payload;
        const description = `started analysis on ${pluginName} for trajectory ${trajectoryName}`;
        await this.activityRepo.addDailyActivity(
            teamId,
            userId,
            ActivityType.AnalysisPerformed,
            description
        );
    }
};
