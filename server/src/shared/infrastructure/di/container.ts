import { container } from 'tsyringe';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import EventBroadcastSocketModule from '@shared/infrastructure/socket/EventBroadcastSocketModule';

export const registerSharedDependencies = (): void => {
    container.registerSingleton(EventBroadcastSocketModule, EventBroadcastSocketModule);
    container.register(SOCKET_TOKENS.SocketModule, { useToken: EventBroadcastSocketModule });
};
