import { Client } from 'pg';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import { QUEUE_NOTIFY_CHANNEL } from '@shared/infrastructure/queues/queue-job-store';
import { singleton } from '@shared/application/utilities/singleton';

const RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

/**
 * Wakes idle workers the moment something is enqueued.
 *
 * Workers poll as well, so this is a latency optimisation and not a correctness
 * requirement — if the listener is down, work is still picked up on the next poll.
 * That is deliberate: a queue whose delivery depends on a live notification
 * silently stops when the connection drops.
 *
 * A LISTEN belongs to one session, so this holds its own connection rather than
 * borrowing from the pool, which would stop delivering as soon as it was recycled.
 */
export class QueueNotifier {
    private readonly waiters = new Map<string, Set<() => void>>();
    private client: Client | null = null;
    private connecting: Promise<void> | null = null;
    private reconnectDelayMs = RECONNECT_DELAY_MS;
    private stopped = false;

    /** Resolves when this queue is notified, or when `timeoutMs` elapses. */
    async waitForWork(queue: string, timeoutMs: number): Promise<void> {
        void this.ensureConnected();

        return new Promise((resolve) => {
            let settled = false;
            const settle = (): void => {
                if (settled) return;
                settled = true;

                this.waiters.get(queue)?.delete(settle);
                clearTimeout(timer);
                resolve();
            };

            const timer = setTimeout(settle, timeoutMs);
            timer.unref();

            const queueWaiters = this.waiters.get(queue);
            if (queueWaiters) {
                queueWaiters.add(settle);
            } else {
                this.waiters.set(queue, new Set([settle]));
            }
        });
    }

    async close(): Promise<void> {
        this.stopped = true;

        for (const queueWaiters of this.waiters.values()) {
            for (const wake of [...queueWaiters]) wake();
        }
        this.waiters.clear();

        const client = this.client;
        this.client = null;
        this.connecting = null;

        if (client) {
            await client.end().catch(() => undefined);
        }
    }

    private ensureConnected(): Promise<void> {
        if (this.stopped || this.client) {
            return Promise.resolve();
        }

        if (!this.connecting) {
            this.connecting = this.connect().catch((error: Error) => {
                logger.warn(`@queue-notifier: listener unavailable, falling back to polling: ${error.message}`);
                this.connecting = null;
                this.scheduleReconnect();
            });
        }

        return this.connecting;
    }

    private async connect(): Promise<void> {
        const client = new Client({
            connectionString: getConfig().databaseUrl,
            application_name: 'volt-cluster-daemon-queue'
        });

        client.on('notification', (message) => {
            if (message.channel !== QUEUE_NOTIFY_CHANNEL || !message.payload) return;

            const queueWaiters = this.waiters.get(message.payload);
            if (!queueWaiters) return;

            /* Copied before waking: each waiter removes itself as it settles. */
            for (const wake of [...queueWaiters]) wake();
        });

        client.on('error', (error: Error) => {
            logger.warn(`@queue-notifier: listener connection failed: ${error.message}`);
            this.scheduleReconnect();
        });

        client.on('end', () => {
            if (!this.stopped) this.scheduleReconnect();
        });

        await client.connect();
        await client.query(`LISTEN ${QUEUE_NOTIFY_CHANNEL}`);

        this.client = client;
        this.reconnectDelayMs = RECONNECT_DELAY_MS;
        logger.info(`@queue-notifier: listening on ${QUEUE_NOTIFY_CHANNEL}`);
    }

    private scheduleReconnect(): void {
        if (this.stopped) return;

        this.client = null;
        this.connecting = null;

        const delay = this.reconnectDelayMs;
        this.reconnectDelayMs = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);

        const timer = setTimeout(() => {
            void this.ensureConnected();
        }, delay);

        timer.unref();
    }
}

export const getQueueNotifier = singleton((): QueueNotifier => new QueueNotifier());
