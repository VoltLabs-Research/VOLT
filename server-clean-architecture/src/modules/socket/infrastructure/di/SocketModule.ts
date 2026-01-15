import { container } from 'tsyringe';
import { SOCKET_TOKENS } from './SocketTokens';
import SocketIOEmitter from '../adapters/SocketIOEmitter';
import SocketIORoomManager from '../adapters/SocketIORoomManager';
import SocketIOEventRegistry from '../adapters/SocketIOEventRegistry';
import SocketGateway from '../gateway/SocketGateway';

/**
 * Register socket module dependencies.
 */
export const registerSocketModule = (): void => {
    container.registerSingleton(SOCKET_TOKENS.SocketEventEmitter, SocketIOEmitter);
    container.registerSingleton(SOCKET_TOKENS.SocketRoomManager, SocketIORoomManager);
    container.registerSingleton(SOCKET_TOKENS.SocketEventRegistry, SocketIOEventRegistry);
    container.registerSingleton(SOCKET_TOKENS.SocketGateway, SocketGateway);
};