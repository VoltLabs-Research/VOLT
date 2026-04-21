import AuthenticateSocketConnectionUseCase from '@modules/socket/application/use-cases/AuthenticateSocketConnectionUseCase';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketGateway from '@modules/socket/socket/SocketGateway';
import TeamSubscriptionSocketModule from '@modules/socket/socket/team-subscription/TeamSubscriptionSocketModule';
import SocketConnectionMapper from '@modules/socket/utilities/SocketConnectionMapper';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const socketDIManifest: ModuleManifest = {
    name: 'socket',
    singletons: [
        [SOCKET_TOKENS.SocketEventEmitter, SocketIOEmitter],
        [SOCKET_TOKENS.SocketRoomManager, SocketIORoomManager],
        [SOCKET_TOKENS.SocketEventRegistry, SocketIOEventRegistry],
        [SOCKET_TOKENS.SocketConnectionMapper, SocketConnectionMapper],
        [SOCKET_TOKENS.SocketGateway, SocketGateway],
        [SOCKET_TOKENS.AuthenticateSocketConnectionUseCase, AuthenticateSocketConnectionUseCase],
        [SOCKET_TOKENS.TeamSubscriptionCoordinator, SocketTeamSubscriptionCoordinator],
        SocketTeamSubscriptionCoordinator,
        [SOCKET_TOKENS.TeamSubscriptionSocketModule, TeamSubscriptionSocketModule]
    ],
    aliases: [
        [SOCKET_TOKENS.SocketEmitter, SOCKET_TOKENS.SocketEventEmitter],
        [SOCKET_TOKENS.SocketModule, SOCKET_TOKENS.TeamSubscriptionSocketModule]
    ]
};
