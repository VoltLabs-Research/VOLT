import Redis from 'ioredis';
import { DaemonConfig } from '../config/env';

export class LocalRedisService {
    private readonly client: Redis;

    constructor(config: DaemonConfig) {
        this.client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            username: config.redis.username,
            password: config.redis.password,
            maxRetriesPerRequest: null,
            lazyConnect: true
        });
    }

    async connect(): Promise<void> {
        if (this.client.status === 'ready') {
            return;
        }

        await this.client.connect();
    }

    async disconnect(): Promise<void> {
        if (this.client.status === 'end') {
            return;
        }

        await this.client.quit();
    }

    async enqueue(queueName: string, payload: Record<string, unknown>): Promise<void> {
        await this.client.rpush(queueName, JSON.stringify(payload));
    }

    async publish(channel: string, payload: Record<string, unknown>): Promise<void> {
        await this.client.publish(channel, JSON.stringify(payload));
    }

    /**
     * Blocking dequeue from a Redis list using BLPOP.
     * Returns the parsed JSON payload, or null if the timeout expires.
     * @param queueName Redis list key to dequeue from
     * @param timeoutSeconds BLPOP timeout (0 = block forever)
     */
    async dequeue<T = Record<string, unknown>>(queueName: string, timeoutSeconds: number = 0): Promise<T | null> {
        const result = await this.client.blpop(queueName, timeoutSeconds);
        if (!result) {
            return null;
        }

        const [, rawPayload] = result;
        return JSON.parse(rawPayload) as T;
    }
}
