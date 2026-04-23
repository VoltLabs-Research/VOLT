import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import PluginExecutionRequestEvent from '@modules/plugin/domain/events/PluginExecutionRequestEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('PluginExecutionRequest')
export default class LogPluginExecutionRequestHandler implements IEventHandler<PluginExecutionRequestEvent>{
    constructor(
        
        private activityRepo: DailyActivityRepository
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
