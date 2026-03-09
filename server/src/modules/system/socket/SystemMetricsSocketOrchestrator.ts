import { inject, injectable } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import type { IMetricsService } from '@modules/system/domain/port/IMetricsService';
import type { ClusterSystemMetrics, SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';

interface MetricsHistoryRequest {
    minutes?: number;
    clusterId?: string;
};

@injectable()
export default class SystemMetricsSocketOrchestrator {
    private metricsInterval: NodeJS.Timeout | null = null;
    private cleanupCounter: number = 0;
    private running: boolean = false;

    constructor(
        @inject(SYSTEM_TOKENS.MetricsService)
        private readonly metricsService: IMetricsService
    ) {}

    private normalizeHistoryRequest(request: number | MetricsHistoryRequest = 5): MetricsHistoryRequest {
        if (typeof request === 'number') {
            return {
                minutes: request
            };
        }

        return {
            minutes: request.minutes,
            clusterId: request.clusterId
        };
    }

    async start(onMetrics: (metrics: ClusterSystemMetrics[]) => void): Promise<void> {
        if (this.running) return;

        this.running = true;
        logger.info('[SystemMetricsSocketOrchestrator] Starting metrics broadcast loop');

        const loop = async () => {
            if (!this.running) return;

            try {
                await this.metricsService.collect();

                this.cleanupCounter++;
                if (this.cleanupCounter >= 30) {
                    this.cleanupCounter = 0;
                    await this.metricsService.cleanExpiredHistory();
                }

                const allMetrics = await this.metricsService.getAllClustersMetrics();
                onMetrics(allMetrics);
            } catch (error) {
                logger.error(`[SystemMetricsSocketOrchestrator] Error in metrics loop: ${error}`);
            }

            if (this.running) {
                this.metricsInterval = setTimeout(loop, 1000);
            }
        };

        await loop();
    }

    async getHistory(request: number | MetricsHistoryRequest = 5): Promise<SystemMetrics[]> {
        const normalizedRequest = this.normalizeHistoryRequest(request);
        if (normalizedRequest.clusterId) {
            return this.metricsService.getHistoryByClusterId(
                normalizedRequest.clusterId,
                normalizedRequest.minutes
            );
        }

        return this.metricsService.getHistory(normalizedRequest.minutes);
    }

    stop(): void {
        this.running = false;
        this.cleanupCounter = 0;

        if (this.metricsInterval) {
            clearTimeout(this.metricsInterval);
            this.metricsInterval = null;
        }
    }
}
