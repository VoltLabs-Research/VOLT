import { logger } from '@shared/infrastructure/logger';
import { purgeExpiredTerminalJobs, reclaimStalledJobs } from '@shared/infrastructure/queues/queue-job-store';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { singleton } from '@shared/application/utilities/singleton';
import { sweepExpiredDaemonState } from '@shared/infrastructure/persistence/DaemonStateStore';

const MAINTENANCE_INTERVAL_MS = readPositiveIntegerEnv('QUEUE_MAINTENANCE_INTERVAL_MS') ?? 60_000;

export class QueueMaintenance {
    private timer: NodeJS.Timeout | null = null;
    private running = false;

    start(): void {
        if (this.timer) return;

        void this.runOnce();

        this.timer = setInterval(() => void this.runOnce(), MAINTENANCE_INTERVAL_MS);
        this.timer.unref();

        logger.info({ intervalMs: MAINTENANCE_INTERVAL_MS }, '@queue-maintenance: started');
    }

    stop(): void {
        if (!this.timer) return;

        clearInterval(this.timer);
        this.timer = null;
    }

    async runOnce(): Promise<void> {
        if (this.running) return;
        this.running = true;

        try {
            const reclaimed = await reclaimStalledJobs();
            if (reclaimed.requeued > 0 || reclaimed.failed > 0) {
                logger.warn(reclaimed, '@queue-maintenance: reclaimed jobs with lapsed leases');
            }

            const [purged, swept] = await Promise.all([
                purgeExpiredTerminalJobs(),
                sweepExpiredDaemonState()
            ]);

            if (purged > 0 || swept > 0) {
                logger.info({
                    purged,
                    swept
                }, '@queue-maintenance: reclaimed space');
            }
        } catch (error) {
            logger.error({ err: error }, '@queue-maintenance: pass failed');
        } finally {
            this.running = false;
        }
    }
}

export const getQueueMaintenance = singleton((): QueueMaintenance => new QueueMaintenance());
