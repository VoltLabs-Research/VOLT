import { inject, singleton } from 'tsyringe';
import { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import {
    ContainerTerminalAttachPayload,
    ITerminalService
} from '@modules/container/domain/port/ITerminalService';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { SocketTerminalClient } from './SocketTerminalClient';

@singleton()
export class ContainerSocketModule extends BaseSocketModule {
    readonly name = 'container';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: any,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: any,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: any,
        @inject(CONTAINER_TOKENS.TerminalService) private terminalService: ITerminalService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if (connection.nativeSocket) {
            const socket = connection.nativeSocket;
            const terminalClient = new SocketTerminalClient(socket);

            socket.on('container:terminal:attach', async (payload: ContainerTerminalAttachPayload) => {
                if (!payload?.containerId) {
                    terminalClient.emitError({
                        code: ErrorCodes.VALIDATION_INVALID_INPUT,
                        details: 'Container id is required'
                    });

                    return;
                }

                await this.terminalService.attach(terminalClient, payload.containerId);
            });
        }
    }
}
