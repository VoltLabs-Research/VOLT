import os from 'node:os';
import { redis } from '@core/config/redis';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import logger from '@shared/infrastructure/logger';

const deserializeSystemMetrics = (payload: string): SystemMetrics => {
    const parsed = JSON.parse(payload) as Omit<SystemMetrics, 'timestamp'> & { timestamp: string };
    return {
        ...parsed,
        timestamp: new Date(parsed.timestamp)
    };
};

class SystemMetricsRedisRepository {
    private readonly clusterId = process.env.TEAM_CLUSTER_ID?.trim()
        || process.env.CLUSTER_ID?.trim()
        || os.hostname();

    private getMetricsKey(clusterId: string): string {
        return `${clusterId}/metrics-history`;
    }

    async save(metrics: SystemMetrics): Promise<void> {
        try {
            if (!redis) {
                logger.warn('Redis not available, skipping Redis storage');
                return;
            }

            await redis.zadd(
                this.getMetricsKey(metrics.teamClusterId ?? this.clusterId),
                metrics.timestamp.getTime(),
                JSON.stringify(metrics)
            );
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

            const [metrics] = await redis.zrevrange(this.getMetricsKey(clusterId), 0, 0);

            return metrics ? deserializeSystemMetrics(metrics) : null;
        } catch (error: unknown) {
            logger.error(`Error reading cluster metrics from Redis: ${error}`);
            return null;
        }
    }
}

export default new SystemMetricsRedisRepository();
