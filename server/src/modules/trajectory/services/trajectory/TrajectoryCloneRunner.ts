import trajectoryCloneCoordinator from '@modules/trajectory/services/TrajectoryCloneCoordinator';
import logger from '@shared/infrastructure/logger';

const CLONE_RUNNER_INTERVAL_MS = 15_000;

export class TrajectoryCloneRunner {
    private interval: ReturnType<typeof setInterval> | null = null;
    private running = false;

    start(): void {
        if (this.interval) {
            return;
        }

        const tick = () => {
            this.runTick().catch((error) => {
                logger.error(error, '[TrajectoryCloneRunner] Failed to process clone tick');
            });
        };

        this.interval = setInterval(tick, CLONE_RUNNER_INTERVAL_MS);
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
        void this.runTick(jobLimit).catch((error) => {
            logger.error(error, '[TrajectoryCloneRunner] Failed to process manual kick');
        });
    }

    private async runTick(jobLimit: number = 1): Promise<void> {
        if (this.running) {
            return;
        }

        this.running = true;

        try {
            await trajectoryCloneCoordinator.runPendingJobs(jobLimit);
        } finally {
            this.running = false;
        }
    }
}

export default new TrajectoryCloneRunner();
