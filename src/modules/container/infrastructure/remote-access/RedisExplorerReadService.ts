import Redis from 'ioredis';
import type { DaemonConfig } from '@/core/config';

interface RedisConnectionOptions {
    host: string;
    port: number;
    username?: string;
    password?: string;
};

interface RedisExplorerDatabaseSummary {
    databaseId: number;
    keyCount: number;
};

interface RedisExplorerValue {
    type: string;
    value: unknown;
};

export class RedisExplorerReadService {
    private readonly client: Redis;
    private readonly connectionOptions: RedisConnectionOptions;

    constructor(
        config: DaemonConfig
    ) {
        this.connectionOptions = {
            host: config.redis.host,
            port: config.redis.port,
            username: config.redis.username,
            password: config.redis.password
        };

        this.client = new Redis({
            ...this.connectionOptions,
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

    async listDatabases(): Promise<RedisExplorerDatabaseSummary[]> {
        await this.connect();

        const info = await this.client.info('keyspace');
        const matches = Array.from(info.matchAll(/db(\d+):keys=(\d+)/g));

        if (matches.length === 0) {
            return [{
                databaseId: 0,
                keyCount: 0
            }];
        }

        return matches.map((match) => ({
            databaseId: Number(match[1]),
            keyCount: Number(match[2])
        }));
    }

    async listKeys(databaseId: number, limit = 200): Promise<string[]> {
        const client = new Redis({
            ...this.connectionOptions,
            db: databaseId,
            lazyConnect: true
        });

        try {
            await client.connect();
            let cursor = '0';
            const keys: string[] = [];

            do {
                const [nextCursor, nextKeys] = await client.scan(cursor, 'COUNT', 100);
                cursor = nextCursor;
                keys.push(...nextKeys);
            } while (cursor !== '0' && keys.length < limit);

            return keys.slice(0, limit);
        } finally {
            await client.quit();
        }
    }

    async getValue(databaseId: number, key: string): Promise<RedisExplorerValue> {
        const client = new Redis({
            ...this.connectionOptions,
            db: databaseId,
            lazyConnect: true
        });

        try {
            await client.connect();
            const type = await client.type(key);

            if (type === 'string') {
                return { type, value: await client.get(key) };
            }

            if (type === 'hash') {
                return { type, value: await client.hgetall(key) };
            }

            if (type === 'list') {
                return { type, value: await client.lrange(key, 0, 99) };
            }

            if (type === 'set') {
                return { type, value: await client.smembers(key) };
            }

            if (type === 'zset') {
                return { type, value: await client.zrange(key, 0, 99, 'WITHSCORES') };
            }

            if (type === 'stream') {
                return { type, value: await client.xrange(key, '-', '+', 'COUNT', 100) };
            }

            return {
                type,
                value: null
            };
        } finally {
            await client.quit();
        }
    }
};
