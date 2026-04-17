import { RedisExplorerReadService } from '@/modules/container/infrastructure/remote-access/RedisExplorerReadService';
import { RemoteExplorerContentType, RemoteExplorerEntryType, RemoteExplorerNodeType, type RemoteExplorerEntry, type RemoteExplorerNode } from '@/contracts';
import type { ReverseChannelCommandResult } from '@/core/reverse-channel/contracts/commandHandler';
import { buildAttachmentContentDisposition, parseRedisDatabasePath, parseRedisKeyPath, toWebReadableStream } from '@/modules/container/infrastructure/remote-access/shared';
import { Readable } from 'node:stream';

export const buildRedisEntries = async (
    redisExplorerReadService: RedisExplorerReadService,
    path: string
): Promise<RemoteExplorerEntry[]> => {
    if (path.trim().length === 0 || path.trim() === '/') {
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

    const keys = await redisExplorerReadService.listKeys(databaseId);
    return keys.map((key) => ({
        id: `db/${databaseId}/key/${encodeURIComponent(key)}`,
        name: key,
        path: `db/${databaseId}/key/${encodeURIComponent(key)}`,
        type: RemoteExplorerEntryType.RedisKey,
        size: null,
        updatedAt: null,
        description: 'Key'
    }));
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

    const value = await redisExplorerReadService.getValue(keyPath.databaseId, keyPath.key);
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

    const value = await redisExplorerReadService.getValue(keyPath.databaseId, keyPath.key);
    const buffer = Buffer.from(JSON.stringify({
        type: value.type,
        key: keyPath.key,
        value: value.value
    }, null, 2), 'utf-8');

    return {
        status: 200,
        headers: {
            'content-type': 'application/json',
            'content-length': String(buffer.byteLength),
            'content-disposition': buildAttachmentContentDisposition(`${keyPath.key}.json`)
        },
        stream: toWebReadableStream(Readable.from([buffer]))
    };
};
