import clusterTransferCoordinator from '@modules/cluster/services/transfer/ClusterTransferCoordinator';
import logger from '@shared/infrastructure/logger';

const TRANSFER_RUNNER_INTERVAL_MS = 30_000;

export class ClusterTransferRunner {
    private interval: ReturnType<typeof setInterval> | null = null;
    private running = false;
    private readonly clusterTransferCoordinator = clusterTransferCoordinator;

    start(): void {
        if (this.interval) {
            return;
        }

        const tick = () => {
            this.runTick().catch((error) => {
                logger.error(error, '[ClusterTransferRunner] Failed to process transfer tick');
            });
        };

        this.interval = setInterval(tick, TRANSFER_RUNNER_INTERVAL_MS);
        this.interval.unref();
        tick();
    }

    stop(): void {
        if (!this.interval) {
            return;
        }

        clearInterval(this.interval);
        this.interval = null;
    }

    kick(jobLimit: number = 1): void {
        void this.runTick(jobLimit, false).catch((error) => {
            logger.error(error, '[ClusterTransferRunner] Failed to process manual transfer kick');
        });
    }

    private async runTick(jobLimit: number = 1, includeAutomaticRebalance: boolean = true): Promise<void> {
        if (this.running) {
            return;
        }

        this.running = true;

        try {
            if (includeAutomaticRebalance) {
                await this.clusterTransferCoordinator.planAutomaticRebalance();
            }
            await this.clusterTransferCoordinator.runPendingJobs(jobLimit);
        } finally {
            this.running = false;
        }
    }
}

export default new ClusterTransferRunner();
