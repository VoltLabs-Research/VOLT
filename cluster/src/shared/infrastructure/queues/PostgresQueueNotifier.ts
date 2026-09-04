import { Client } from 'pg';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import { getDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { QueueWaiters } from '@shared/infrastructure/queues/QueueWaiters';
import type { QueueNotifier } from '@shared/infrastructure/queues/queue-notifier-contract';

const QUEUE_NOTIFY_CHANNEL = 'volt_queue_jobs';
const RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

export class PostgresQueueNotifier implements QueueNotifier {
    private readonly waiters = new QueueWaiters();
    private client: Client | null = null;
    private connecting: Promise<void> | null = null;
    private reconnectDelayMs = RECONNECT_DELAY_MS;
    private stopped = false;

    async notify(queue: string): Promise<void> {
        await getDaemonDataSource().manager.query('SELECT pg_notify($1, $2)', [QUEUE_NOTIFY_CHANNEL, queue]);
    }

    async waitForWork(queue: string, timeoutMs: number): Promise<void> {
        void this.ensureConnected();

        return this.waiters.wait(queue, timeoutMs);
    }

    async close(): Promise<void> {
        this.stopped = true;
        this.waiters.wakeAll();

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

            this.waiters.wake(message.payload);
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
