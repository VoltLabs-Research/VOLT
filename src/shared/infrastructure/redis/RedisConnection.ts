import { singleton } from '@shared/application/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import type { DaemonConfig } from '@core/config/daemon';
import type { RedisConnectionOptions } from '@shared/contracts/types/redis-connection';
import Redis from 'ioredis';

const LIST_APPEND_CHUNK_SIZE = 256;

export class RedisConnection {
    private readonly client: Redis;
    private readonly connectionOptions: RedisConnectionOptions;

    constructor(config: DaemonConfig) {
        this.connectionOptions = {
            host: config.redis.host,
            port: config.redis.port,
            username: config.redis.username,
            password: config.redis.password,
            keyPrefix: config.redis.keyPrefix
        };

        this.client = new Redis({
            ...this.connectionOptions,
            maxRetriesPerRequest: null,
            lazyConnect: true
        });
    }

    async connect(): Promise<void> {
        if (this.client.status === 'ready') return;

        await this.client.connect();
    }

    getConnectionOptions(): RedisConnectionOptions {
        return this.connectionOptions;
    }

    readonly disconnect = async (): Promise<void> => {
        if (this.client.status === 'end') return;

        await this.client.quit();
    };

    readonly setKeyIfAbsent = async (key: string, value: string, ttlSeconds?: number): Promise<boolean> => {
        await this.connect();

        const result = ttlSeconds === undefined
            ? await this.client.set(key, value, 'NX')
            : await this.client.set(key, value, 'EX', ttlSeconds, 'NX');

        return result === 'OK';
    };

    readonly decrementKey = async (key: string): Promise<number> => {
        await this.connect();

        return this.client.decr(key);
    };

    readonly deleteKey = async (key: string): Promise<number> => {
        await this.connect();

        return this.client.del(key);
    };

    readonly deleteKeys = async (keys: string[]): Promise<number> => {
        if (keys.length === 0) {
            return 0;
        }

        await this.connect();

        return this.client.del(...keys);
    };

    readonly getValue = async (key: string): Promise<string | null> => {
        await this.connect();

        return this.client.get(key);
    };

    readonly setValueWithTtl = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
        await this.connect();

        await this.client.setex(key, ttlSeconds, value);
    };

    readonly appendListWithTtl = async (key: string, values: string[], ttlSeconds: number): Promise<void> => {
        await this.connect();

        const pipeline = this.client.pipeline();
        pipeline.del(key);
        if (values.length > 0) {
            for (let index = 0; index < values.length; index += LIST_APPEND_CHUNK_SIZE) {
                pipeline.rpush(key, ...values.slice(index, index + LIST_APPEND_CHUNK_SIZE));
            }
            pipeline.expire(key, ttlSeconds);
        }

        await pipeline.exec();
    };

    readonly popListHead = async (key: string): Promise<string | null> => {
        await this.connect();

        return this.client.lpop(key);
    };
}

export const getRedisConnection = singleton((): RedisConnection => new RedisConnection(getConfig()));
