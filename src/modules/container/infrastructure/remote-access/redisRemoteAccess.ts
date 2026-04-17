import { RedisExplorerReadService } from '@/modules/container/infrastructure/remote-access/RedisExplorerReadService';
import { RemoteExplorerContentType, RemoteExplorerEntryType, RemoteExplorerNodeType } from '@/contracts';
import type { ReverseChannelCommandResult } from '@/core/reverse-channel/contracts/commandHandler';
import type { RemoteExplorerEntry, RemoteExplorerNode } from '@/contracts';
import { buildAttachmentContentDisposition, normalizeExplorerPath, parseRedisDatabasePath, parseRedisKeyPath, toWebReadableStream } from '@/modules/container/infrastructure/remote-access/shared';
import { Readable } from 'node:stream';
import Redis from 'ioredis';

type RedisExplorerValue = {
    type: string;
    value: Awaited<ReturnType<Redis['get']>>
        | Awaited<ReturnType<Redis['hgetall']>>
        | Awaited<ReturnType<Redis['lrange']>>
        | Awaited<ReturnType<Redis['smembers']>>
        | Awaited<ReturnType<Redis['zrange']>>
        | Awaited<ReturnType<Redis['xrange']>>
        | null;
};

const getValue = async (redisExplorerReadService: RedisExplorerReadService, databaseId: number, key: string): Promise<RedisExplorerValue> => {
    const client = new Redis({
        ...redisExplorerReadService.connectionOptions,
        db: databaseId,
        lazyConnect: true
    });

    try {
        await client.connect();
        const type = await client.type(key);

        if (type === 'string') return { type, value: await client.get(key) };
        if (type === 'hash') return { type, value: await client.hgetall(key) };
        if (type === 'list') return { type, value: await client.lrange(key, 0, 99) };
        if (type === 'set') return { type, value: await client.smembers(key) };
        if (type === 'zset') return { type, value: await client.zrange(key, 0, 99, 'WITHSCORES') };
        if (type === 'stream') return { type, value: await client.xrange(key, '-', '+', 'COUNT', 100) };

        return { type, value: null };
    } finally {
        await client.quit();
    }
};

export const buildRedisEntries = async (
    redisExplorerReadService: RedisExplorerReadService,
    path: string
): Promise<RemoteExplorerEntry[]> => {
    if (normalizeExplorerPath(path).length === 0) {
        const databases = await redisExplorerReadService.listDatabases();

        return databases.map((database) => ({
            id: `db/${database.databaseId}`,
            name: `db${database.databaseId}`,
            path: `db/${database.databaseId}`,
            type: RemoteExplorerEntryType.RedisDatabase,
            size: null,
            updatedAt: null,
            description: `${database.keyCount} keys`
        }));
    }

    const databaseId = parseRedisDatabasePath(path);
    if (databaseId === null) {
        return [];
    }

    const client = new Redis({
        ...redisExplorerReadService.connectionOptions,
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
        } while (cursor !== '0' && keys.length < 200);

        return keys.slice(0, 200).map((key) => ({
            id: `db/${databaseId}/key/${encodeURIComponent(key)}`,
            name: key,
            path: `db/${databaseId}/key/${encodeURIComponent(key)}`,
            type: RemoteExplorerEntryType.RedisKey,
            size: null,
            updatedAt: null,
            description: 'Key'
        }));
    } finally {
        await client.quit();
    }
};

export const buildRedisNode = async (
    redisExplorerReadService: RedisExplorerReadService,
    path: string
): Promise<RemoteExplorerNode> => {
    const keyPath = parseRedisKeyPath(path);
    if (!keyPath) {
        return {
            path,
            title: 'Redis',
            type: RemoteExplorerNodeType.RedisValue,
            contentType: RemoteExplorerContentType.Empty,
            textContent: null,
            mongoDocuments: []
        };
    }

    const value = await getValue(redisExplorerReadService, keyPath.databaseId, keyPath.key);
    return {
        path,
        title: keyPath.key,
        type: RemoteExplorerNodeType.RedisValue,
        contentType: RemoteExplorerContentType.Text,
        textContent: JSON.stringify({
            type: value.type,
            value: value.value
        }, null, 2),
        mongoDocuments: []
    };
};

export const buildRedisDownloadResponse = async (
    redisExplorerReadService: RedisExplorerReadService,
    path: string
): Promise<ReverseChannelCommandResult> => {
    const keyPath = parseRedisKeyPath(path);
    if (!keyPath) {
        throw new Error('Redis download requires a valid key path (db/{id}/key/{key})');
    }

    const value = await getValue(redisExplorerReadService, keyPath.databaseId, keyPath.key);
    const buffer = Buffer.from(JSON.stringify({
        type: value.type,
        key: keyPath.key,
        value: value.value
    }, null, 2), 'utf-8');

    return {
        status: 200,
        headers: {
            'content-type': 'application/json',
            'content-length': `${buffer.byteLength}`,
            'content-disposition': buildAttachmentContentDisposition(`${keyPath.key}.json`)
        },
        stream: toWebReadableStream(Readable.from([buffer]))
    };
};
