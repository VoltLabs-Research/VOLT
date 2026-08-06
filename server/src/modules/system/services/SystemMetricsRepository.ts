import os from 'node:os';
import ClusterMetricSample from '@modules/system/models/ClusterMetricSample';
import logger from '@shared/infrastructure/logger';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';

/**
 * How long samples are kept. The store this replaced appended to a sorted set it
 * never trimmed, so history grew without bound for the life of a deployment;
 * nothing reads further back than the dashboards' window.
 */
export const METRIC_RETENTION_MS = 24 * 60 * 60 * 1000;

const toSystemMetrics = (sample: ClusterMetricSample): SystemMetrics => {
    const payload = sample.payload as Omit<SystemMetrics, 'timestamp'> & { timestamp: string };
    return {
        ...payload,
        timestamp: sample.recordedAt
    };
};

class SystemMetricsRepository {
    private readonly clusterId = process.env.TEAM_CLUSTER_ID?.trim()
        || process.env.CLUSTER_ID?.trim()
        || os.hostname();

    /**
     * Metric loss must never take a request down with it, so failures here are
     * logged and swallowed exactly as they were before.
     */
    async save(metrics: SystemMetrics): Promise<void> {
        try {
            /* An opaque `jsonb` column does not survive TypeORM's deep-partial
               mapping of the insert literal, so the shape is asserted here. */
            await ClusterMetricSample.getRepository().insert({
                clusterId: metrics.teamClusterId ?? this.clusterId,
                recordedAt: metrics.timestamp,
                payload: metrics as unknown as Record<string, unknown>
            } as never);
        } catch (error: unknown) {
            logger.error(`Error saving cluster metrics: ${error}`);
        }
    }

    async getHistoryByClusterId(clusterId: string, minutes: number = 5): Promise<SystemMetrics[]> {
        try {
            const since = new Date(Date.now() - minutes * 60 * 1000);
            const samples = await ClusterMetricSample.getRepository()
                .createQueryBuilder('sample')
                .where('sample.clusterId = :clusterId', { clusterId })
                .andWhere('sample.recordedAt >= :since', { since })
                .orderBy('sample.recordedAt', 'ASC')
                .getMany();

            return samples.map(toSystemMetrics);
        } catch (error: unknown) {
            logger.error(`Error reading cluster metrics history: ${error}`);
            return [];
        }
    }

    async getLatestByClusterId(clusterId: string): Promise<SystemMetrics | null> {
        try {
            const sample = await ClusterMetricSample.getRepository()
                .createQueryBuilder('sample')
                .where('sample.clusterId = :clusterId', { clusterId })
                .orderBy('sample.recordedAt', 'DESC')
                .limit(1)
                .getOne();

            return sample ? toSystemMetrics(sample) : null;
        } catch (error: unknown) {
            logger.error(`Error reading latest cluster metrics: ${error}`);
            return null;
        }
    }
}

export default new SystemMetricsRepository();
