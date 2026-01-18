import { container } from 'tsyringe';
import { SOCKET_TOKENS } from './SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/adapters/SocketIOEmitter';
import SocketIORoomManager from '@modules/socket/infrastructure/adapters/SocketIORoomManager';
import SocketIOEventRegistry from '@modules/socket/infrastructure/adapters/SocketIOEventRegistry';
import SocketMapper from '@modules/socket/infrastructure/mappers/SocketMapper';
import SocketGateway from '@modules/socket/infrastructure/gateway/SocketGateway';
import EventBroadcastSocketModule from '@modules/socket/infrastructure/modules/EventBroadcastSocketModule';
import TeamPresenceSocketModule from '@modules/socket/infrastructure/modules/TeamPresenceSocketModule';
import TeamJobsSocketModule from '@modules/team/infrastructure/socket/TeamJobsSocketModule';
import SystemSocketModule from '@modules/system/infrastructure/socket/SystemSocketModule';
import ChatSocketModule from '@modules/chat/infrastructure/socket/ChatSocketModule';

/**
 * Register socket module dependencies.
 */
export const registerSocketModule = (): void => {
    container.registerSingleton(SOCKET_TOKENS.SocketEventEmitter, SocketIOEmitter);
    container.register(SOCKET_TOKENS.SocketEmitter, { useToken: SOCKET_TOKENS.SocketEventEmitter });
    container.registerSingleton(SOCKET_TOKENS.SocketRoomManager, SocketIORoomManager);
    container.registerSingleton(SOCKET_TOKENS.SocketEventRegistry, SocketIOEventRegistry);
    container.registerSingleton(SOCKET_TOKENS.SocketMapper, SocketMapper);
    container.registerSingleton(SOCKET_TOKENS.SocketGateway, SocketGateway);

    // Register Socket Modules
    container.registerSingleton('SocketModule', EventBroadcastSocketModule);
    container.registerSingleton('SocketModule', TeamPresenceSocketModule);
    container.registerSingleton('SocketModule', TeamJobsSocketModule);
    container.registerSingleton('SocketModule', SystemSocketModule);
    container.registerSingleton('SocketModule', ChatSocketModule);
};