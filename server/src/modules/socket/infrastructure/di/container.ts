import { container } from 'tsyringe';
import AuthenticateSocketConnectionUseCase from '@modules/socket/application/use-cases/AuthenticateSocketConnectionUseCase';
import SocketTeamSubscriptionCoordinator from '@modules/socket/services/team-subscription/SocketTeamSubscriptionCoordinator';
import SocketIOEmitter from '@modules/socket/infrastructure/adapters/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/adapters/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/adapters/SocketIORoomManager';
import { SOCKET_TOKENS } from './SocketTokens';
import SocketGateway from '@modules/socket/infrastructure/gateway/SocketGateway';
import TeamSubscriptionSocketModule from '@modules/socket/infrastructure/modules/TeamSubscriptionSocketModule';
import SocketConnectionMapper from '@modules/socket/infrastructure/connection/SocketConnectionMapper';

export const registerSocketDependencies = (): void => {
    container.registerSingleton(SOCKET_TOKENS.SocketEventEmitter, SocketIOEmitter);
    container.register(SOCKET_TOKENS.SocketEmitter, { useToken: SOCKET_TOKENS.SocketEventEmitter });
    container.registerSingleton(SOCKET_TOKENS.SocketRoomManager, SocketIORoomManager);
    container.registerSingleton(SOCKET_TOKENS.SocketEventRegistry, SocketIOEventRegistry);
    container.registerSingleton(SOCKET_TOKENS.SocketConnectionMapper, SocketConnectionMapper);
    container.registerSingleton(SOCKET_TOKENS.SocketGateway, SocketGateway);
    container.registerSingleton(SOCKET_TOKENS.AuthenticateSocketConnectionUseCase, AuthenticateSocketConnectionUseCase);
    container.registerSingleton(SOCKET_TOKENS.TeamSubscriptionCoordinator, SocketTeamSubscriptionCoordinator);
    container.registerSingleton(SocketTeamSubscriptionCoordinator, SocketTeamSubscriptionCoordinator);
    container.registerSingleton(SOCKET_TOKENS.TeamSubscriptionSocketModule, TeamSubscriptionSocketModule);
    container.register(SOCKET_TOKENS.SocketModule, { useToken: SOCKET_TOKENS.TeamSubscriptionSocketModule });
};
