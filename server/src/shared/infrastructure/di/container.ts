import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import EventBroadcastSocketModule from '@shared/infrastructure/socket/EventBroadcastSocketModule';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import TeamClusterRedisFactory from '@shared/infrastructure/services/TeamClusterRedisFactory';
import TeamClusterServiceResolver from '@shared/infrastructure/services/TeamClusterServiceResolver';
import TeamClusterStorageResolver from '@shared/infrastructure/services/TeamClusterStorageResolver';
import { container } from 'tsyringe';

export const registerSharedDependencies = (): void => {
    container.registerSingleton(EventBroadcastSocketModule, EventBroadcastSocketModule);
    container.register(SOCKET_TOKENS.SocketModule, { useToken: EventBroadcastSocketModule });
    container.registerSingleton(SHARED_TOKENS.TeamClusterDaemonClient, TeamClusterDaemonClient);
    container.registerSingleton(SHARED_TOKENS.TeamClusterServiceResolver, TeamClusterServiceResolver);
    container.registerSingleton(SHARED_TOKENS.TeamClusterStorageResolver, TeamClusterStorageResolver);
    container.registerSingleton(SHARED_TOKENS.TeamClusterRedisFactory, TeamClusterRedisFactory);
};
