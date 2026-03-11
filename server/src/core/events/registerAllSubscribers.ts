import { analysisSubscriberManifest } from '@modules/analysis/infrastructure/events/subscribers';
import { authSubscriberManifest } from '@modules/auth/infrastructure/events/subscribers';
import { chatSubscriberManifest } from '@modules/chat/infrastructure/events/subscribers';
import { containerSubscriberManifest } from '@modules/container/infrastructure/events/subscribers';
import { dailyActivitySubscriberManifest } from '@modules/daily-activity/infrastructure/events/subscribers';
import { notificationSubscriberManifest } from '@modules/notification/infrastructure/events/subscribers';
import { pluginSubscriberManifest } from '@modules/plugin/infrastructure/events/subscribers';
import { scriptingSubscriberManifest } from '@modules/scripting/infrastructure/events/subscribers';
import { whiteboardSubscriberManifest } from '@modules/whiteboards/infrastructure/events/subscribers';
import { latexSubscriberManifest } from '@modules/latex/infrastructure/events/subscribers';
import { sessionSubscriberManifest } from '@modules/session/infrastructure/events/subscribers';
import { simulationCellSubscriberManifest } from '@modules/simulation-cell/infrastructure/events/subscribers';
import { sshSubscriberManifest } from '@modules/ssh/infrastructure/events/subscribers';
import { teamSubscriberManifest } from '@modules/team/infrastructure/events/subscribers';
import { trajectorySubscriberManifest } from '@modules/trajectory/infrastructure/events/subscribers';
import { registerSubscribers, type SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import logger from '@shared/infrastructure/logger';

const SUBSCRIBER_MANIFESTS: SubscriberManifest[] = [
    teamSubscriberManifest,
    notificationSubscriberManifest,
    chatSubscriberManifest,
    trajectorySubscriberManifest,
    analysisSubscriberManifest,
    sshSubscriberManifest,
    pluginSubscriberManifest,
    scriptingSubscriberManifest,
    latexSubscriberManifest,
    dailyActivitySubscriberManifest,
    containerSubscriberManifest,
    simulationCellSubscriberManifest,
    sessionSubscriberManifest,
    authSubscriberManifest,
    whiteboardSubscriberManifest
];

/**
 * Central registration point for all event subscribers across modules.
 */
export const registerAllSubscribers = async (): Promise<void> => {
    logger.info('@event-bus: Registering all event subscribers...');

    await Promise.all(SUBSCRIBER_MANIFESTS.map((manifest) => registerSubscribers(manifest)));

    logger.info('@event-bus: All event subscribers registered successfully');
};
