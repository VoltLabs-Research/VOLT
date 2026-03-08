import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import EventBroadcastSocketModule from '@shared/infrastructure/socket/EventBroadcastSocketModule';
import { container } from 'tsyringe';

export const registerSharedDependencies = (): void => {
    container.registerSingleton(EventBroadcastSocketModule, EventBroadcastSocketModule);
    container.register(SOCKET_TOKENS.SocketModule, { useToken: EventBroadcastSocketModule });
};
