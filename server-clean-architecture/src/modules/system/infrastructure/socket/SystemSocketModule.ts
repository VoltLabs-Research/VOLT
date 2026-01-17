import { inject, singleton } from 'tsyringe';
import BaseSocketModule from '@/src/modules/socket/infrastructure/gateway/BaseSocketModule';
import { ISocketConnection } from '@/src/modules/socket/domain/ports/ISocketModule';
import { SOCKET_TOKENS } from '@/src/modules/socket/infrastructure/di/SocketTokens';
import logger from '@/src/shared/infrastructure/logger';
import MetricsCollectorService from '../services/MetricsCollectorService';

@singleton()
export default class SystemSocketModule extends BaseSocketModule {
    public readonly name = 'SystemSocketModule';
    private metricsInterval: NodeJS.Timeout | null = null;

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
                // logger.debug('[SystemSocketModule] Loop start');
                // Collect local metrics and save to Redis
                await this.metricsService.collect();
                // logger.debug('[SystemSocketModule] Collected local metrics');

                // Get aggregated metrics for ALL clusters
                const allMetrics = await this.metricsService.getAllClustersMetrics();
                // logger.debug(`[SystemSocketModule] Got ${allMetrics.length} cluster metrics`);

                // Broadcast globally to valid connections
                this.broadcast('metrics:all', allMetrics);
                // logger.debug(`[SystemSocketModule] Broadcasted metrics:all (${allMetrics.length} items)`);
            } catch (error) {
                logger.error(`[SystemSocketModule] Error in metrics loop: ${error}`);
            }

            // Schedule next run: 1 second interval
            this.metricsInterval = setTimeout(loop, 1000);
        };

        // Start the loop
        loop();
    }

    onConnection(connection: ISocketConnection): void {
        // Handle request for historical data
        this.on(connection.id, 'metrics:history', async (conn, hours: number = 24) => {
            try {
                logger.info(`[SystemSocketModule] Client ${conn.id} requested history for ${hours}h`);
                const history = await this.metricsService.getMetricsFromRedis(hours);
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
