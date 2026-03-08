import { container } from 'tsyringe';
import AuthenticateSocketConnectionUseCase from '@modules/socket/application/use-cases/AuthenticateSocketConnectionUseCase';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import { SOCKET_TOKENS } from './SocketTokens';
import SocketGateway from '@modules/socket/socket/SocketGateway';
import TeamSubscriptionSocketModule from '@modules/socket/socket/team-subscription/TeamSubscriptionSocketModule';
import SocketConnectionMapper from '@modules/socket/utilities/SocketConnectionMapper';

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
