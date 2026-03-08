import { registerTeamSubscribers } from '@modules/team/infrastructure/events/subscribers';
import { registerChatSubscribers } from '@modules/chat/infrastructure/events/subscribers';
import { registerTrajectorySubscribers } from '@modules/trajectory/infrastructure/events/subscribers';
import { registerAnalysisSubscribers } from '@modules/analysis/infrastructure/events/subscribers';
import { registerSSHSubscribers } from '@modules/ssh/infrastructure/events/subscribers';
import { registerPluginSubscribers } from '@modules/plugin/infrastructure/events/subscribers';
import { registerScriptingSubscribers } from '@modules/scripting/infrastructure/events/subscribers';
import { registerNotificationSubscribers } from '@modules/notification/infrastructure/events/subscribers';
import { registerDailyActivitySubscribers } from '@modules/daily-activity/infrastructure/events/subscribers';
import { registerContainerSubscribers } from '@modules/container/infrastructure/events/subscribers';
import { registerSimulationCellSubscribers } from '@modules/simulation-cell/infrastructure/events/subscribers';
import { registerSessionSubscribers } from '@modules/session/infrastructure/events/subscribers';
import { registerAISubscribers } from '@modules/ai/infrastructure/events/subscribers';
import { registerRasterSubscribers } from '@modules/raster/infrastructure/events/subscribers';
import { registerAuthSubscribers } from '@modules/auth/infrastructure/events/subscribers';
import { registerJobsSubscribers } from '@modules/jobs/infrastructure/events/subscribers';
import logger from '@shared/infrastructure/logger';

/**
 * Central registration point for all event subscribers across modules.
 */
export const registerAllSubscribers = async (): Promise<void> => {
    logger.info('@event-bus: Registering all event subscribers...');
    
    await Promise.all([
        registerTeamSubscribers(),
        registerNotificationSubscribers(),
        registerChatSubscribers(),
        registerTrajectorySubscribers(),
        registerAnalysisSubscribers(),
        registerSSHSubscribers(),
        registerPluginSubscribers(),
        registerScriptingSubscribers(),
        registerRasterSubscribers(),
        registerDailyActivitySubscribers(),
        registerContainerSubscribers(),
        registerSimulationCellSubscribers(),
        registerSessionSubscribers(),
        registerAISubscribers(),
        registerAuthSubscribers(),
        registerJobsSubscribers()
    ]);

    logger.info('@event-bus: All event subscribers registered successfully');
};
