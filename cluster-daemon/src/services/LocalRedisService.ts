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
}
