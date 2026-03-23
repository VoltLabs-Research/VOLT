import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import EventBroadcastSocketModule from '@shared/infrastructure/socket/EventBroadcastSocketModule';
import TempStorageLifecycleService from '@shared/infrastructure/services/TempStorageLifecycleService';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import TeamClusterRedisFactory from '@shared/infrastructure/services/TeamClusterRedisFactory';
import TeamClusterServiceResolver from '@shared/infrastructure/services/TeamClusterServiceResolver';
import TeamClusterStorageResolver from '@shared/infrastructure/services/TeamClusterStorageResolver';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerSharedDependencies = (): void => {
    registerModuleDependencies({
        singletons: [
            EventBroadcastSocketModule,
            [SHARED_TOKENS.DaemonCredentialGuard, DaemonCredentialGuard],
            [SHARED_TOKENS.TempStorageLifecycleService, TempStorageLifecycleService],
            [SHARED_TOKENS.TeamClusterDaemonClient, TeamClusterDaemonClient],
            [SHARED_TOKENS.TeamClusterObjectGatewayClient, TeamClusterObjectGatewayClient],
            [SHARED_TOKENS.TeamClusterServiceResolver, TeamClusterServiceResolver],
            [SHARED_TOKENS.TeamClusterStorageResolver, TeamClusterStorageResolver],
            [SHARED_TOKENS.TeamClusterRedisFactory, TeamClusterRedisFactory]
        ],
        aliases: [[SOCKET_TOKENS.SocketModule, EventBroadcastSocketModule]]
    });
};
