import { registerTeamSubscribers } from '@modules/team/infrastructure/events/subscribers';
import { registerChatSubscribers } from '@modules/chat/infrastructure/events/subscribers';
import { registerTrajectorySubscribers } from '@modules/trajectory/infrastructure/events/subscribers';
import { registerAnalysisSubscribers } from '@modules/analysis/infrastructure/events/subscribers';
import { registerSSHSubscribers } from '@modules/ssh/infrastructure/events/subscribers';
import { registerPluginSubscribers } from '@modules/plugin/infrastructure/events/subscribers';
import { registerNotificationSubscribers } from '@modules/notification/infrastructure/events/subscribers';
import { registerDailyActivitySubscribers } from '@modules/daily-activity/infrastructure/events/subscribers';
import { registerApiTrackerSubscribers } from '@modules/api-tracker/infrastructure/events/subscribers';
import { registerContainerSubscribers } from '@modules/container/infrastructure/events/subscribers';
import logger from '@shared/infrastructure/logger';

/**
 * Central registration point for all event subscribers across modules.
 */
export const registerAllSubscribers = async (): Promise<void> => {
    logger.info('@event-bus: Registering all event subscribers...');
    
    await Promise.all([
        registerTeamSubscribers(),
        registerNotificationSubscribers(),
        registerApiTrackerSubscribers(),
        registerChatSubscribers(),
        registerTrajectorySubscribers(),
        registerAnalysisSubscribers(),
        registerSSHSubscribers(),
        registerPluginSubscribers(),
        registerDailyActivitySubscribers(),
        registerContainerSubscribers()
    ]);

    logger.info('@event-bus: All event subscribers registered successfully');
};
