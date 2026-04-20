import type { DaemonConfig } from '@/core/config';
import { Service } from '@/core/decorators/service';
import Redis, { type RedisOptions } from 'ioredis';

interface RedisExplorerDatabaseSummary {
    databaseId: number;
    keyCount: number;
};

@Service('redisExplorer')
export class RedisExplorer {
    private readonly client: Redis;
    readonly connectionOptions: RedisOptions;

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

};
