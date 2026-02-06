import { inject, singleton } from 'tsyringe';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import { ISocketConnection } from '@modules/socket/domain/ports/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import logger from '@shared/infrastructure/logger';
import MetricsCollectorService from '@modules/system/infrastructure/services/MetricsCollectorService';

@singleton()
export default class SystemSocketModule extends BaseSocketModule {
    public readonly name = 'SystemSocketModule';
    private metricsInterval: NodeJS.Timeout | null = null;
    private cleanupCounter: number = 0;

    constructor(
        @inject('IMetricsService')
        private readonly metricsService: MetricsCollectorService,
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: any,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: any,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: any
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[SystemSocketModule] Starting initialization...');
        this.startMetricsCollection();
    }

    private startMetricsCollection(): void {
        if (this.metricsInterval) return;

        logger.info('[SystemSocketModule] Starting metrics broadcast loop');

        const loop = async () => {
            try {
                // Collect local metrics and save to Redis
                await this.metricsService.collect();

                // Clean old metrics every 30 seconds (30 iterations)
                this.cleanupCounter++;
                if (this.cleanupCounter >= 30) {
                    this.cleanupCounter = 0;
                    await this.metricsService.cleanOldMetrics();
                }

                // Get aggregated metrics for ALL clusters
                const allMetrics = await this.metricsService.getAllClustersMetrics();

                // Broadcast globally to valid connections
                this.broadcast('metrics:all', allMetrics);
            } catch (error) {
                logger.error(`[SystemSocketModule] Error in metrics loop: ${error}`);
            }

            // Schedule next run: 1 second interval
            this.metricsInterval = setTimeout(loop, 1000);
        };

        // Start the loop
        loop();
    }

    async onConnection(connection: ISocketConnection): Promise<void> {
        this.on(connection.id, 'metrics:history', async (conn, minutes: number = 5) => {
            try {
                logger.info(`[SystemSocketModule] Client ${conn.id} requested history for ${minutes} minutes`);
                const history = await this.metricsService.getMetricsFromRedisMinutes(minutes);
                this.emitToSocket(conn.id, 'metrics:history', history);
            } catch (error) {
                logger.error(`[SystemSocketModule] Error fetching history: ${error}`);
            }
        });
    }

    public onDestroy(): void {
        if (this.metricsInterval) {
            clearTimeout(this.metricsInterval);
            this.metricsInterval = null;
        }
    }
}
