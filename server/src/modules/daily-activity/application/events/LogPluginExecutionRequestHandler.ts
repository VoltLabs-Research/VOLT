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
        // const description = `User ${event.userId} started analysis on ${event.pluginName} for trajectory ${event.trajectoryName}`;
        // TODO: In the dashboard I am showing {user full name} + description, for this reason 
        // remove "User ${event.userId} ". This is temporary since it is not a clean solution, 
        // because directly here in the description I could put the username ;)
        const description = `started analysis on ${event.pluginName} for trajectory ${event.trajectoryName}`;
        await this.activityRepo.addDailyActivity(
            event.teamId, 
            event.userId, 
            ActivityType.AnalysisPerformed, 
            description
        );
    }
};