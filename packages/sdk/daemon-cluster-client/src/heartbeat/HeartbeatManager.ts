import type { HeartbeatOptions } from './types';

const DEFAULT_INTERVAL_MS = 30_000;

export class HeartbeatManager {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private running = false;

    constructor(
        private readonly options: HeartbeatOptions,
        private readonly sendHeartbeat: (payload: object) => Promise<void>,
        private readonly onError: (error: unknown) => void
    ) {}

    start(): void {
        if (this.running) {
            return;
        }

        this.running = true;
        this.scheduleNext(true);
    }

    stop(): void {
        this.running = false;
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private scheduleNext(immediate: boolean): void {
        if (!this.running) {
            return;
        }

        const interval = this.options.interval ?? DEFAULT_INTERVAL_MS;
        const jitter = this.options.jitter ? Math.random() * this.options.jitter : 0;
        const delay = immediate ? 0 : interval + jitter;

        this.timer = setTimeout(() => {
            this.fire().finally(() => this.scheduleNext(false));
        }, delay);
    }

    private async fire(): Promise<void> {
        if (!this.running) {
            return;
        }

        let payload: object = {};

        if (this.options.payloadFactory) {
            try {
                payload = await this.options.payloadFactory();
            } catch (error: unknown) {
                this.onError(error);
                return;
            }
        }

        try {
            await this.sendHeartbeat(payload);
        } catch (error: unknown) {
            this.onError(error);
        }
    }
};
