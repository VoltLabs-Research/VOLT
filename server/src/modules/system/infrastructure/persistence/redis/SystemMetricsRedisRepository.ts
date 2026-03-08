import os from 'os';
import { injectable } from 'tsyringe';
import { redis } from '@core/config/redis';
import logger from '@shared/infrastructure/logger';
import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import {
    deserializeSystemMetrics,
    serializeSystemMetrics,
    type SystemMetrics
} from '@modules/system/domain/value-objects/SystemMetrics';

const ACTIVE_CLUSTERS_KEY = 'active_clusters';

@injectable()
export default class SystemMetricsRedisRepository implements ISystemMetricsRepository {
    private readonly metricsHistoryKey: string;
    private readonly metricsTTL: number;
    private readonly clusterId: string;

    constructor(metricsKey: string = 'metrics-history', ttl: number = 60) {
        this.clusterId = process.env.CLUSTER_ID || os.hostname();
        this.metricsHistoryKey = metricsKey;
        this.metricsTTL = ttl;
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

            await redis.zadd(this.getMetricsKey(), timestamp, metricsJson);
            await redis.zadd(ACTIVE_CLUSTERS_KEY, timestamp, this.clusterId);
        } catch (error: unknown) {
            logger.error(`Error saving to Redis: ${error}`);
        }
    }

    async getLatest(): Promise<SystemMetrics | null> {
        try {
            if (!redis) {
                logger.warn('Redis not available');
                return null;
            }

            const metrics = await redis.zrevrange(this.getMetricsKey(), 0, 0);
            if (metrics && metrics.length > 0) {
                return deserializeSystemMetrics(metrics[0]);
            }

            return null;
        } catch (error: unknown) {
            logger.error(`Error reading latest from Redis: ${error}`);
            return null;
        }
    }

    async getHistory(minutes: number = 5): Promise<SystemMetrics[]> {
        try {
            if (!redis) {
                logger.warn('Redis not available');
                return [];
            }

            const startTime = Date.now() - (minutes * 60 * 1000);
            const metricsData = await redis.zrangebyscore(this.getMetricsKey(), startTime, '+inf');

            return metricsData.map(deserializeSystemMetrics);
        } catch (error: unknown) {
            logger.error(`Error reading from Redis: ${error}`);
            return [];
        }
    }

    async deleteExpired(): Promise<number> {
        try {
            if (!redis) return 0;

            const cutoffTime = Date.now() - (this.metricsTTL * 1000);
            const removed = await redis.zremrangebyscore(this.getMetricsKey(), '-inf', cutoffTime);

            if (removed > 0) {
                logger.info(`Cleaned ${removed} old metrics from Redis`);
            }

            return removed;
        } catch (error: unknown) {
            logger.error(`Error cleaning old metrics: ${error}`);
            return 0;
        }
    }

    async listActiveClusterIds(cutoffTime: number): Promise<string[]> {
        try {
            if (!redis) return [];

            try {
                await redis.zremrangebyscore(ACTIVE_CLUSTERS_KEY, '-inf', cutoffTime);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : '';
                if (message.includes('WRONGTYPE')) {
                    logger.warn('Detected legacy active_clusters Set type. Resetting to Sorted Set.');
                    await redis.del(ACTIVE_CLUSTERS_KEY);
                } else {
                    throw error;
                }
            }

            return redis.zrange(ACTIVE_CLUSTERS_KEY, 0, -1);
        } catch (error: unknown) {
            logger.error(`Error listing active clusters from Redis: ${error}`);
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
