import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { IDailyActivityRepository } from '@modules/daily-activity/domain/ports/IDailyActivityRepository';
import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import PluginExecutionRequestEvent from '@modules/plugin/domain/events/PluginExecutionRequestEvent';

@injectable()
export default class LogPluginExecutionRequestHandler implements IEventHandler<PluginExecutionRequestEvent>{
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private activityRepo: IDailyActivityRepository
    ){}

    async handle(event: PluginExecutionRequestEvent): Promise<void>{
        const description = `User ${event.userId} started analysis on ${event.pluginName} for trajectory ${event.trajectoryName}`;
        await this.activityRepo.addDailyActivity(
            event.teamId, 
            event.userId, 
            ActivityType.AnalysisPerformed, 
            description
        );
    }
};