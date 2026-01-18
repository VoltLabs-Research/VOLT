import { container } from 'tsyringe';
import { SOCKET_TOKENS } from './SocketTokens';
import SocketIOEmitter from '../adapters/SocketIOEmitter';
import SocketIORoomManager from '../adapters/SocketIORoomManager';
import SocketIOEventRegistry from '../adapters/SocketIOEventRegistry';
import SocketMapper from '../mappers/SocketMapper';
import SocketGateway from '../gateway/SocketGateway';
import EventBroadcastSocketModule from '../modules/EventBroadcastSocketModule';
import TeamPresenceSocketModule from '../modules/TeamPresenceSocketModule';
import TeamJobsSocketModule from '@/src/modules/team/infrastructure/socket/TeamJobsSocketModule';
import SystemSocketModule from '@/src/modules/system/infrastructure/socket/SystemSocketModule';
import ChatSocketModule from '@/src/modules/chat/infrastructure/socket/ChatSocketModule';

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