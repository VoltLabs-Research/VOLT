import type { HeartbeatOptions } from './types';

const DEFAULT_INTERVAL_MS = 30_000;

/**
 * Manages a periodic heartbeat loop that sends `runtime.heartbeat` commands
 * to the Volt server.
 *
 * Individual heartbeat failures are logged and swallowed - the loop continues
 * regardless. Only a caller-initiated `stop()` terminates it.
 */
export class HeartbeatManager {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private running = false;

    constructor(
        private readonly options: HeartbeatOptions,
        /** Performs the actual heartbeat send. Should not throw unless a fatal error occurs. */
        private readonly sendHeartbeat: (payload: object) => Promise<void>,
        /** Called for non-fatal errors so consumers can log or observe failures. */
        private readonly onError: (error: unknown) => void
    ) {}

    /** Starts the heartbeat loop and fires an initial heartbeat immediately. */
    start(): void {
        if (this.running) {
            return;
        }

        this.running = true;
        this.scheduleNext(true);
    }

    /** Stops the heartbeat loop. Any in-flight heartbeat is not cancelled. */
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
