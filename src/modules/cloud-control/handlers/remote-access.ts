import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { MinioService, RedisConnectionService } from '@/modules/platform/services';
import type { ReverseChannelCommandHandler, ReverseChannelCommandResult } from '../services';
import { readRecord, readString } from './payloadValidation';

interface RemoteAccessHandlersDependencies {
    minioService: MinioService;
    redisConnectionService: RedisConnectionService;
}

interface RemoteExplorerEntry {
    id: string;
    name: string;
    path: string;
    type: string;
    size: number | null;
    updatedAt: string | null;
    description: string | null;
}

interface MongoExplorerDocument {
    id: string;
    value: Record<string, unknown>;
}

interface RemoteExplorerNode {
    path: string;
    title: string;
    type: string;
    contentType: string;
    textContent: string | null;
    mongoDocuments: MongoExplorerDocument[];
}

const MAX_MONGO_DOCUMENTS = 100;
const MAX_OBJECT_PREVIEW_BYTES = 65_536;

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizePath = (value: string): string => {
    return value.replace(/^\/+|\/+$/g, '');
};

const splitPathSegments = (value: string): string[] => {
    return normalizePath(value).split('/').filter(Boolean);
};

/**
 * Joins remote explorer path segments using POSIX-style separators while discarding
 * duplicated leading, trailing, or intermediate slashes between provided segments.
 */
export const joinExplorerPathSegments = (...segments: string[]): string => {
    return segments.flatMap(splitPathSegments).join('/');
};

const toMongoDocument = (value: unknown): MongoExplorerDocument => {
    const jsonString = JSON.stringify(value);
    const parsedValue: unknown = jsonString ? JSON.parse(jsonString) : {};
    const recordValue = isRecord(parsedValue)
        ? parsedValue
        : {};

    const idValue = recordValue._id;
    const id = typeof idValue === 'string'
        ? idValue
        : JSON.stringify(idValue ?? '');

    return {
        id,
        value: recordValue
    };
};

const parseRedisDatabasePath = (path: string): number | null => {
    const segments = splitPathSegments(path);
    if (segments.length < 2 || segments[0] !== 'db') {
        return null;
    }

    const databaseId = Number(segments[1]);
    return Number.isInteger(databaseId) ? databaseId : null;
};

const parseRedisKeyPath = (path: string): { databaseId: number; key: string; } | null => {
    const segments = splitPathSegments(path);
    if (segments.length < 4 || segments[0] !== 'db' || segments[2] !== 'key') {
        return null;
    }

    const databaseId = Number(segments[1]);
    if (!Number.isInteger(databaseId)) {
        return null;
    }

    return {
        databaseId,
        key: decodeURIComponent(segments.slice(3).join('/'))
    };
};

const buildMinioEntries = async (minioService: MinioService, path: string): Promise<RemoteExplorerEntry[]> => {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath) {
        return minioService.listBuckets().map((bucket) => ({
            id: bucket,
            name: bucket,
            path: bucket,
            type: 'bucket',
            size: null,
            updatedAt: null,
            description: 'Bucket'
        }));
    }

    const segments = splitPathSegments(normalizedPath);
    const [bucket, ...prefixSegments] = segments;
    if (!bucket) {
        return [];
    }

    const prefix = prefixSegments.join('/');
    const effectivePrefix = prefix ? `${prefix.replace(/\/+$/g, '')}/` : '';
    const objectKeys = await minioService.listObjects(bucket, effectivePrefix);
    const entries = new Map<string, RemoteExplorerEntry>();

    for (const objectKey of objectKeys) {
        const remainder = effectivePrefix.length > 0
            ? objectKey.slice(effectivePrefix.length)
            : objectKey;

        if (!remainder) {
            continue;
        }

        const nextSeparatorIndex = remainder.indexOf('/');
        if (nextSeparatorIndex >= 0) {
            const directoryName = remainder.slice(0, nextSeparatorIndex);
            const childPath = joinExplorerPathSegments(bucket, effectivePrefix, directoryName);

            if (!entries.has(childPath)) {
                entries.set(childPath, {
                    id: childPath,
                    name: directoryName,
                    path: childPath,
                    type: 'directory',
                    size: null,
                    updatedAt: null,
                    description: 'Directory'
                });
            }
            continue;
        }

        const childPath = joinExplorerPathSegments(bucket, effectivePrefix, remainder);

        entries.set(childPath, {
            id: childPath,
            name: remainder,
            path: childPath,
            type: 'object',
            size: null,
            updatedAt: null,
            description: 'Object'
        });
    }

    return Array.from(entries.values()).sort((left, right) => left.name.localeCompare(right.name));
};

const buildMinioNode = async (minioService: MinioService, path: string): Promise<RemoteExplorerNode> => {
    const normalizedPath = normalizePath(path);
    const segments = splitPathSegments(normalizedPath);
    const [bucket, ...objectKeySegments] = segments;
    const objectKey = objectKeySegments.join('/');

    if (!bucket || !objectKey) {
        return {
            path,
            title: bucket || 'MinIO',
            type: 'object',
            contentType: 'empty',
            textContent: null,
            mongoDocuments: []
        };
    }

    const stream = await minioService.getObjectStream(bucket, objectKey);
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
            if (totalBytes >= MAX_OBJECT_PREVIEW_BYTES) {
                return;
            }

            const remainingBytes = MAX_OBJECT_PREVIEW_BYTES - totalBytes;
            const safeChunk = chunk.length > remainingBytes
                ? chunk.subarray(0, remainingBytes)
                : chunk;
            chunks.push(safeChunk);
            totalBytes += safeChunk.length;
        });
        stream.on('end', () => resolve());
        stream.on('error', reject);
    });

    const previewText = Buffer.concat(chunks).toString('utf-8');

    return {
        path,
        title: objectKey,
        type: 'object',
        contentType: 'text',
        textContent: previewText,
        mongoDocuments: []
    };
};

const buildMongoEntries = async (): Promise<RemoteExplorerEntry[]> => {
    const database = mongoose.connection.db;
    if (!database) {
        throw new Error('MongoDB connection is not ready');
    }

    const collections = await database.listCollections({}, { nameOnly: true }).toArray();

    return collections
        .map((collection) => ({
            id: collection.name,
            name: collection.name,
            path: collection.name,
            type: 'collection',
            size: null,
            updatedAt: null,
            description: 'Collection'
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
};

const buildMongoNode = async (path: string): Promise<RemoteExplorerNode> => {
    const collectionName = normalizePath(path);
    const database = mongoose.connection.db;
    if (!database) {
        throw new Error('MongoDB connection is not ready');
    }

    if (!collectionName) {
        return {
            path,
            title: 'MongoDB',
            type: 'collection',
            contentType: 'empty',
            textContent: null,
            mongoDocuments: []
        };
    }

    const documents = await database.collection(collectionName)
        .find({})
        .limit(MAX_MONGO_DOCUMENTS)
        .toArray();

    return {
        path,
        title: collectionName,
        type: 'collection',
        contentType: 'mongo-documents',
        textContent: null,
        mongoDocuments: documents.map(toMongoDocument)
    };
};

const buildRedisEntries = async (redisConnectionService: RedisConnectionService, path: string): Promise<RemoteExplorerEntry[]> => {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath) {
        const databases = await redisConnectionService.listExplorerDatabases();

        return databases.map((database) => ({
            id: `db/${database.databaseId}`,
            name: `db${database.databaseId}`,
            path: `db/${database.databaseId}`,
            type: 'redis-database',
            size: null,
            updatedAt: null,
            description: `${database.keyCount} keys`
        }));
    }

    const databaseId = parseRedisDatabasePath(normalizedPath);
    if (databaseId === null) {
        return [];
    }

    const keys = await redisConnectionService.listExplorerKeys(databaseId);

    return keys.map((key) => ({
        id: `db/${databaseId}/key/${encodeURIComponent(key)}`,
        name: key,
        path: `db/${databaseId}/key/${encodeURIComponent(key)}`,
        type: 'redis-key',
        size: null,
        updatedAt: null,
        description: 'Key'
    }));
};

const buildRedisNode = async (
    redisConnectionService: RedisConnectionService,
    path: string
): Promise<RemoteExplorerNode> => {
    const keyPath = parseRedisKeyPath(path);
    if (!keyPath) {
        return {
            path,
            title: 'Redis',
            type: 'redis-value',
            contentType: 'empty',
            textContent: null,
            mongoDocuments: []
        };
    }

    const value = await redisConnectionService.getExplorerValue(keyPath.databaseId, keyPath.key);

    return {
        path,
        title: keyPath.key,
        type: 'redis-value',
        contentType: 'text',
        textContent: JSON.stringify({
            type: value.type,
            value: value.value
        }, null, 2),
        mongoDocuments: []
    };
};

interface MinioLikeError {
    code?: string;
};

const isMinioNotFoundError = (error: unknown): error is MinioLikeError => {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && (error.code === 'NotFound' || error.code === 'NoSuchKey');
};

/**
 * Reads a MinIO object as a stream and returns it with appropriate headers for download.
 *
 * @param minioService - The MinIO service instance.
 * @param path - The object path in `{bucket}/{objectKey}` format.
 * @returns A stream response with content-type from metadata and content-disposition for download.
 * @throws When the object is not found or the path is missing bucket/key segments.
 */
const buildMinioDownloadResponse = async (
    minioService: MinioService,
    path: string
): Promise<ReverseChannelCommandResult> => {
    const normalizedPath = normalizePath(path);
    const segments = splitPathSegments(normalizedPath);
    const [bucket, ...objectKeySegments] = segments;
    const objectKey = objectKeySegments.join('/');

    if (!bucket || !objectKey) {
        throw new Error('MinIO download requires a bucket and object key');
    }

    let stat;
    let nodeStream;

    try {
        stat = await minioService.statObject(bucket, objectKey);
        nodeStream = await minioService.getObjectStream(bucket, objectKey);
    } catch (error) {
        if (isMinioNotFoundError(error)) {
            throw Object.assign(new Error(`Object not found: ${bucket}/${objectKey}`), {
                statusCode: 404
            });
        }

        throw error;
    }

    const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    const filename = objectKey.split('/').pop() ?? objectKey;
    const contentType = typeof stat.metaData['content-type'] === 'string'
        ? stat.metaData['content-type']
        : 'application/octet-stream';

    const headers: Record<string, string> = {
        'content-type': contentType,
        'content-length': String(stat.size),
        'content-disposition': `attachment; filename="${filename}"`
    };

    return { status: 200, headers, stream };
};

/**
 * Exports documents from a Mongo collection as a pretty-printed JSON array.
 *
 * @param path - The collection name.
 * @returns A stream response containing up to MAX_MONGO_DOCUMENTS documents as JSON.
 * @throws When the MongoDB connection is not ready or the collection name is empty.
 */
const buildMongoDownloadResponse = async (path: string): Promise<ReverseChannelCommandResult> => {
    const collectionName = normalizePath(path);
    const database = mongoose.connection.db;

    if (!database) {
        throw new Error('MongoDB connection is not ready');
    }

    if (!collectionName) {
        throw new Error('Mongo download requires a collection name');
    }

    const documents = await database.collection(collectionName)
        .find({})
        .limit(MAX_MONGO_DOCUMENTS)
        .toArray();

    const jsonContent = JSON.stringify(documents.map(toMongoDocument), null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');
    const nodeStream = Readable.from([buffer]);
    const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    const headers: Record<string, string> = {
        'content-type': 'application/json',
        'content-length': String(buffer.byteLength),
        'content-disposition': `attachment; filename="${collectionName}.json"`
    };

    return { status: 200, headers, stream };
};

/**
 * Exports a Redis key's type and value as pretty-printed JSON.
 *
 * @param redisConnectionService - The Redis connection service instance.
 * @param path - The key path in `db/{id}/key/{encodedKey}` format.
 * @returns A stream response with the key's type and value serialized as JSON.
 * @throws When the key path cannot be parsed.
 */
const buildRedisDownloadResponse = async (
    redisConnectionService: RedisConnectionService,
    path: string
): Promise<ReverseChannelCommandResult> => {
    const keyPath = parseRedisKeyPath(path);

    if (!keyPath) {
        throw new Error('Redis download requires a valid key path (db/{id}/key/{key})');
    }

    const value = await redisConnectionService.getExplorerValue(keyPath.databaseId, keyPath.key);
    const jsonContent = JSON.stringify({
        type: value.type,
        key: keyPath.key,
        value: value.value
    }, null, 2);

    const buffer = Buffer.from(jsonContent, 'utf-8');
    const nodeStream = Readable.from([buffer]);
    const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    const safeFilename = keyPath.key.replace(/[^a-zA-Z0-9._-]/g, '_');

    const headers: Record<string, string> = {
        'content-type': 'application/json',
        'content-length': String(buffer.byteLength),
        'content-disposition': `attachment; filename="${safeFilename}.json"`
    };

    return { status: 200, headers, stream };
};

export const createRemoteAccessHandlers = (deps: RemoteAccessHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'remote.explorer.list',
        execute: async (payload) => {
            const body = readRecord(payload, 'payload');
            const target = readString(body.target, 'target');
            const path = typeof body.path === 'string'
                ? body.path
                : '';

            if (target === 'mongo-documents') {
                return { data: await buildMongoEntries() };
            }

            if (target === 'redis-data') {
                return { data: await buildRedisEntries(deps.redisConnectionService, path) };
            }

            if (target === 'minio') {
                return { data: await buildMinioEntries(deps.minioService, path) };
            }

            throw new Error(`Unsupported remote explorer target: ${target}`);
        }
    },
    {
        command: 'remote.explorer.node',
        execute: async (payload) => {
            const body = readRecord(payload, 'payload');
            const target = readString(body.target, 'target');
            const path = typeof body.path === 'string'
                ? body.path
                : '';

            if (target === 'mongo-documents') {
                return { data: await buildMongoNode(path) };
            }

            if (target === 'redis-data') {
                return { data: await buildRedisNode(deps.redisConnectionService, path) };
            }

            if (target === 'minio') {
                return { data: await buildMinioNode(deps.minioService, path) };
            }

            throw new Error(`Unsupported remote explorer target: ${target}`);
        }
    },
    {
        command: 'remote.explorer.download',
        execute: async (payload) => {
            const body = readRecord(payload, 'payload');
            const target = readString(body.target, 'target');
            const path = typeof body.path === 'string'
                ? body.path
                : '';

            if (target === 'minio') {
                return buildMinioDownloadResponse(deps.minioService, path);
            }

            if (target === 'mongo-documents') {
                return buildMongoDownloadResponse(path);
            }

            if (target === 'redis-data') {
                return buildRedisDownloadResponse(deps.redisConnectionService, path);
            }

            throw new Error(`Unsupported remote explorer download target: ${target}`);
        }
    }
];
