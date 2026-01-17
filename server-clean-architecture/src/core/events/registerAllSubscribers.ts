import { registerTeamSubscribers } from '@/src/modules/team/infrastructure/events/subscribers';
import { registerChatSubscribers } from '@/src/modules/chat/infrastructure/events/subscribers';
import { registerTrajectorySubscribers } from '@/src/modules/trajectory/infrastructure/events/subscribers';
import { registerAnalysisSubscribers } from '@/src/modules/analysis/infrastructure/events/subscribers';
import { registerSSHSubscribers } from '@/src/modules/ssh/infrastructure/events/subscribers';
import { registerPluginSubscribers } from '@/src/modules/plugin/infrastructure/events/subscribers';
import { registerNotificationSubscribers } from '@/src/modules/notification/infrastructure/events/subscribers';
import { registerDailyActivitySubscribers } from '@/src/modules/daily-activity/infrastructure/events/subscribers';
import { registerApiTrackerSubscribers } from '@/src/modules/api-tracker/infrastructure/events/subscribers';
import { registerContainerSubscribers } from '@/src/modules/container/infrastructure/events/subscribers';
import logger from '@/src/shared/infrastructure/logger';

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
