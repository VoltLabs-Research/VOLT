import ClusterMetricSample from '@modules/system/models/ClusterMetricSample';
import DomainEventSpoolEntry from '@shared/infrastructure/persistence/models/DomainEventSpoolEntry';
import logger from '@shared/infrastructure/logger';
import { LessThanOrEqual } from 'typeorm';
import { METRIC_RETENTION_MS } from '@modules/system/services/SystemMetricsRepository';
import { sweepExpiredKeyValues } from '@shared/infrastructure/keyvalue/KeyValueStore';

const MAINTENANCE_INTERVAL_MS = 300_000;

const SPOOL_RETENTION_MS = 600_000;

let timer: NodeJS.Timeout | null = null;
let running = false;

const runOnce = async (): Promise<void> => {
    if (running) return;
    running = true;

    try {
        const [keyValues, spooled, metrics] = await Promise.all([
            sweepExpiredKeyValues(),
            DomainEventSpoolEntry.delete({
                createdAt: LessThanOrEqual(new Date(Date.now() - SPOOL_RETENTION_MS))
            }),
            ClusterMetricSample.delete({
                recordedAt: LessThanOrEqual(new Date(Date.now() - METRIC_RETENTION_MS))
            })
        ]);

        const removed = keyValues + (spooled.affected ?? 0) + (metrics.affected ?? 0);
        if (removed > 0) {
            logger.info(
                `@runtime-state-maintenance: reclaimed keyValues=${keyValues} spooled=${spooled.affected ?? 0} metrics=${metrics.affected ?? 0}`
            );
        }
    } catch (error: unknown) {
        logger.error(`@runtime-state-maintenance: pass failed: ${error}`);
    } finally {
        running = false;
    }
};

export const startRuntimeStateMaintenance = (): void => {
    if (timer) return;

    void runOnce();

    timer = setInterval(() => void runOnce(), MAINTENANCE_INTERVAL_MS);
    timer.unref();
};

export const stopRuntimeStateMaintenance = (): void => {
    if (!timer) return;

    clearInterval(timer);
    timer = null;
};
