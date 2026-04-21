import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import {
    deleteManyOnTeamDeletedHandler,
    deleteManyOnUserDeletedHandler
} from '@shared/application/events/cascadeDeleteHandlerFactories';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';

const TeamDeletedEventHandler = deleteManyOnTeamDeletedHandler(SSH_TOKENS.SSHConnectionRepository);
const UserDeletedEventHandler = deleteManyOnUserDeletedHandler(SSH_TOKENS.SSHConnectionRepository);

export const sshSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'user.deleted': UserDeletedEventHandler
};
