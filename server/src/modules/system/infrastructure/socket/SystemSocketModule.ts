import { inject, singleton } from 'tsyringe';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import logger from '@shared/infrastructure/logger';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import SystemMetricsSocketOrchestrator from '@modules/system/infrastructure/socket/SystemMetricsSocketOrchestrator';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';

@singleton()
export default class SystemSocketModule extends BaseSocketModule {
    public readonly name = 'SystemSocketModule';

    constructor(
        @inject(SYSTEM_TOKENS.MetricsSocketOrchestrator)
        private readonly metricsOrchestrator: SystemMetricsSocketOrchestrator,
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[SystemSocketModule] Starting initialization...');
        await this.metricsOrchestrator.start((allMetrics) => {
            this.broadcast('metrics:all', allMetrics);
        });
    }

    async onConnection(connection: ISocketConnection): Promise<void> {
        this.on(connection.id, 'metrics:history', async (conn, minutes: number = 5) => {
            try {
                logger.info(`[SystemSocketModule] Client ${conn.id} requested history for ${minutes} minutes`);
                const history = await this.metricsOrchestrator.getHistory(minutes);
                this.emitToSocket(conn.id, 'metrics:history', history);
            } catch (error) {
                logger.error(`[SystemSocketModule] Error fetching history: ${error}`);
            }
        });
    }

    public onDestroy(): void {
        this.metricsOrchestrator.stop();
    }
}
