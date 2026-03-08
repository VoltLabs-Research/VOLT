import { DebugSocketOrchestrator } from '@modules/plugin/infrastructure/socket/debug/DebugSocketOrchestrator';

import { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { inject, singleton } from 'tsyringe';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import logger from '@shared/infrastructure/logger';

import type { DebugStartPayload } from '@modules/plugin/infrastructure/socket/debug/DebugSocketPayloads';

@singleton()
export default class DebugSocketModule extends BaseSocketModule {
    public readonly name = 'DebugSocketModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: any,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: any,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: any,
        @inject(DebugSocketOrchestrator)
        private readonly orchestrator: DebugSocketOrchestrator
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[DebugSocketModule] Initialized');
    }

    onConnection(connection: ISocketConnection): void {
        this.on<DebugStartPayload>(connection.id, 'debug:start', async (conn, payload) => {
            await this.orchestrator.start(conn, payload);
        });

        this.on<{ sessionId: string }>(connection.id, 'debug:step', async (conn, payload) => {
            this.orchestrator.step(conn.id, payload.sessionId);
        });

        this.on<{ sessionId: string }>(connection.id, 'debug:continue', async (conn, payload) => {
            this.orchestrator.continue(conn.id, payload.sessionId);
        });

        this.on<{ sessionId: string }>(connection.id, 'debug:stop', async (conn, payload) => {
            this.orchestrator.stop(conn.id, payload.sessionId);
        });

        this.onDisconnect(connection.id, async () => {
            this.orchestrator.disconnect(connection.id);
        });
    }

    async onShutdown(): Promise<void> {
        await this.orchestrator.shutdown();
        logger.info('[DebugSocketModule] Shutdown complete');
    }
};
