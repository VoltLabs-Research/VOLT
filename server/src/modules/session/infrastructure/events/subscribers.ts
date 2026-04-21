import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import { deleteManyOnUserDeletedHandler } from '@shared/application/events/cascadeDeleteHandlerFactories';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';

const UserDeletedEventHandler = deleteManyOnUserDeletedHandler(SESSION_TOKENS.SessionRepository);

export const sessionSubscriberManifest: SubscriberManifest = {
    'user.deleted': UserDeletedEventHandler
};
