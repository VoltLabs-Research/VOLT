import { redis } from '@core/config/redis';
import type { SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import {
    deserializeSystemMetrics,
    serializeSystemMetrics
} from '@modules/system/infrastructure/persistence/redis/SystemMetricsRedisMapper';
import { resolveSystemMetricsIdentity } from '@modules/system/utilities/resolveSystemMetricsIdentity';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

@Singleton()
export default class SystemMetricsRedisRepository {
    private readonly metricsHistoryKey = 'metrics-history';
    private readonly clusterId: string;

    constructor() {
        this.clusterId = resolveSystemMetricsIdentity().clusterId;
    }

    private getMetricsKey(clusterId: string = this.clusterId): string {
        return `${clusterId}/${this.metricsHistoryKey}`;
    }

    async save(metrics: SystemMetrics): Promise<void> {
        try {
            if (!redis) {
                logger.warn('Redis not available, skipping Redis storage');
                return;
            }

            const timestamp = metrics.timestamp.getTime();
            const metricsJson = serializeSystemMetrics(metrics);
            const clusterId = metrics.teamClusterId ?? this.clusterId;

            await redis.zadd(this.getMetricsKey(clusterId), timestamp, metricsJson);
        } catch (error: unknown) {
            logger.error(`Error saving to Redis: ${error}`);
        }
    }

    async getHistoryByClusterId(clusterId: string, minutes: number = 5): Promise<SystemMetrics[]> {
        try {
            if (!redis) {
                logger.warn('Redis not available');
                return [];
            }

            const startTime = Date.now() - (minutes * 60 * 1000);
            const metricsData = await redis.zrangebyscore(this.getMetricsKey(clusterId), startTime, '+inf');

            return metricsData.map(deserializeSystemMetrics);
        } catch (error: unknown) {
            logger.error(`Error reading from Redis: ${error}`);
            return [];
        }
    }

    async getLatestByClusterId(clusterId: string): Promise<SystemMetrics | null> {
        try {
            if (!redis) return null;

            const metrics = await redis.zrevrange(this.getMetricsKey(clusterId), 0, 0);
            if (metrics && metrics.length > 0) {
                return deserializeSystemMetrics(metrics[0]);
            }

            return null;
        } catch (error: unknown) {
            logger.error(`Error reading cluster metrics from Redis: ${error}`);
            return null;
        }
    }
}
