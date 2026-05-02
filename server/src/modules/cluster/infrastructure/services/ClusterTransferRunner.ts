import ClusterTransferCoordinator from '@modules/cluster/application/services/ClusterTransferCoordinator';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

const TRANSFER_RUNNER_INTERVAL_MS = 30_000;

@Singleton()
export default class ClusterTransferRunner {
    private interval: ReturnType<typeof setInterval> | null = null;
    private running = false;

    constructor(
        private readonly clusterTransferCoordinator: ClusterTransferCoordinator
    ) {}

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
        this.interval.unref?.();
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
        void this.runTick({
            jobLimit,
            includeAutomaticRebalance: false
        }).catch((error) => {
            logger.error(error, '[ClusterTransferRunner] Failed to process manual transfer kick');
        });
    }

    private async runTick(options: {
        jobLimit?: number;
        includeAutomaticRebalance?: boolean;
    } = {}): Promise<void> {
        if (this.running) {
            return;
        }

        this.running = true;

        try {
            if (options.includeAutomaticRebalance !== false) {
                await this.clusterTransferCoordinator.planAutomaticRebalance();
            }
            await this.clusterTransferCoordinator.runPendingJobs(options.jobLimit ?? 1);
        } finally {
            this.running = false;
        }
    }
}
