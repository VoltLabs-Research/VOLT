import os from 'node:os';
import { redis } from '@core/config/redis';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import logger from '@shared/infrastructure/logger';

const readIdentityEnv = (key: string): string | null => {
    const value = process.env[key]?.trim();
    return value ? value : null;
};

export const resolveSystemMetricsIdentity = (): string => {
    const teamClusterId = readIdentityEnv('TEAM_CLUSTER_ID');
    const serverId = readIdentityEnv('CLUSTER_ID') ?? os.hostname();

    return teamClusterId ?? serverId;
};

type SerializedSystemMetrics = Omit<SystemMetrics, 'timestamp'> & {
    timestamp: string;
};

const serializeSystemMetrics = (metrics: SystemMetrics): string => JSON.stringify(metrics);

const deserializeSystemMetrics = (payload: string): SystemMetrics => {
    const parsed = JSON.parse(payload) as SerializedSystemMetrics;
    return {
        ...parsed,
        timestamp: new Date(parsed.timestamp)
    };
};

class SystemMetricsRedisRepository {
    private readonly metricsHistoryKey = 'metrics-history';
    private readonly clusterId: string;

    constructor() {
        this.clusterId = resolveSystemMetricsIdentity();
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
            if (metrics.length > 0) {
                return deserializeSystemMetrics(metrics[0]);
            }

            return null;
        } catch (error: unknown) {
            logger.error(`Error reading cluster metrics from Redis: ${error}`);
            return null;
        }
    }
}

export default new SystemMetricsRedisRepository();
