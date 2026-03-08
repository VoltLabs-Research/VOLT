import { DebugSocketOrchestrator } from '@modules/plugin/socket/debug/DebugSocketOrchestrator';

import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { inject, singleton } from 'tsyringe';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import logger from '@shared/infrastructure/logger';

import type { DebugStartPayload } from '@modules/plugin/socket/debug/DebugSocketPayloads';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';

interface DebugSessionControlPayload {
    sessionId: string;
};

@singleton()
export default class DebugSocketModule extends BaseSocketModule {
    public readonly name = 'DebugSocketModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry,
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

        this.on<DebugSessionControlPayload>(connection.id, 'debug:step', async (conn, payload) => {
            this.orchestrator.step(conn.id, payload.sessionId);
        });

        this.on<DebugSessionControlPayload>(connection.id, 'debug:continue', async (conn, payload) => {
            this.orchestrator.continue(conn.id, payload.sessionId);
        });

        this.on<DebugSessionControlPayload>(connection.id, 'debug:stop', async (conn, payload) => {
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
