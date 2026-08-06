import ClusterMetricSample from '@modules/system/models/ClusterMetricSample';
import DomainEventSpoolEntry from '@shared/infrastructure/persistence/models/DomainEventSpoolEntry';
import logger from '@shared/infrastructure/logger';
import { LessThanOrEqual } from 'typeorm';
import { METRIC_RETENTION_MS } from '@modules/system/services/SystemMetricsRepository';
import { sweepExpiredKeyValues } from '@shared/infrastructure/keyvalue/KeyValueStore';

const MAINTENANCE_INTERVAL_MS = 300_000;

/**
 * How long a parked event body is kept.
 *
 * A spooled payload is read and deleted by the subscriber that handles it, so a
 * row only survives when nothing was listening for that event. Generous enough
 * that a subscriber restarting mid-delivery still finds its payload.
 */
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
        /* Housekeeping must never take the server down; the next pass retries. */
        logger.error(`@runtime-state-maintenance: pass failed: ${error}`);
    } finally {
        running = false;
    }
};

/**
 * Reclaims space from the runtime state tables.
 *
 * None of this is required for correctness — expired entries are already
 * invisible to readers, because every read filters on the deadline. It exists so
 * a long-lived deployment does not accumulate dead receipts, unread event bodies
 * and metric history indefinitely.
 */
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
