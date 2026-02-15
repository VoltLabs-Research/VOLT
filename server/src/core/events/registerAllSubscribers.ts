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
import { registerSimulationCellSubscribers } from '@modules/simulation-cell/infrastructure/events/subscribers';
import logger from '@shared/infrastructure/logger';

const SUBSCRIBERS: { name: string; register: () => Promise<void> }[] = [
    { name: 'Team', register: registerTeamSubscribers },
    { name: 'Notification', register: registerNotificationSubscribers },
    { name: 'ApiTracker', register: registerApiTrackerSubscribers },
    { name: 'Chat', register: registerChatSubscribers },
    { name: 'Trajectory', register: registerTrajectorySubscribers },
    { name: 'Analysis', register: registerAnalysisSubscribers },
    { name: 'SSH', register: registerSSHSubscribers },
    { name: 'Plugin', register: registerPluginSubscribers },
    { name: 'DailyActivity', register: registerDailyActivitySubscribers },
    { name: 'Container', register: registerContainerSubscribers },
    { name: 'SimulationCell', register: registerSimulationCellSubscribers }
];

/**
 * Central registration point for all event subscribers across modules.
 */
export const registerAllSubscribers = async (): Promise<void> => {
    logger.info('@event-bus: Registering all event subscribers...');
    
    // CORE-023: Use Promise.allSettled instead of Promise.all
    const results = await Promise.allSettled(
        SUBSCRIBERS.map(s => s.register())
    );

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            logger.error(`@event-bus: Failed to register ${SUBSCRIBERS[index].name} subscribers:`, result.reason);
        }
    });

    const failedCount = results.filter(r => r.status === 'rejected').length;
    if (failedCount > 0) {
        logger.warn(`@event-bus: ${failedCount}/${SUBSCRIBERS.length} subscriber registrations failed`);
    } else {
        logger.info('@event-bus: All event subscribers registered successfully');
    }
};
