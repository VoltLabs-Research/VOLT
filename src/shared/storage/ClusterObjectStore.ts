import { logger } from '@/core/logger';
import type { DaemonConfig, DaemonRuntimeConfig } from '@/core/config';
import type { MinioService } from '@/modules/platform/services';
import type { Readable } from 'node:stream';
import type { VoltServerObjectStoreProxyClient } from './VoltServerObjectStoreProxyClient';

interface MinioObjectStat {
    size?: unknown;
    etag?: unknown;
    lastModified?: unknown;
    metaData?: Record<string, unknown>;
}

export interface ClusterObjectHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

export interface ClusterObjectStreamResponse extends ClusterObjectHeadResponse {
    stream: Readable;
}

export interface ClusterObjectStore {
    head(ownerClusterId: string, bucket: string, objectKey: string): Promise<ClusterObjectHeadResponse>;
    exists(ownerClusterId: string, bucket: string, objectKey: string): Promise<boolean>;
    getStream(ownerClusterId: string, bucket: string, objectKey: string): Promise<ClusterObjectStreamResponse>;
    getBuffer(ownerClusterId: string, bucket: string, objectKey: string): Promise<Buffer>;
    putObject(input: {
        ownerClusterId: string;
        bucket: string;
        objectKey: string;
        body: Buffer;
        metadata?: Record<string, string>;
    }): Promise<void>;
    putObjectStream(input: {
        ownerClusterId: string;
        bucket: string;
        objectKey: string;
        stream: Readable;
        size: number;
        metadata?: Record<string, string>;
    }): Promise<void>;
    list(ownerClusterId: string, request: {
        bucket: string;
        prefix?: string;
        cursor?: string;
        limit?: number;
    }): Promise<{ keys: string[]; nextCursor?: string; }>;
    deleteByPrefix(ownerClusterId: string, bucket: string, prefix: string): Promise<number | undefined>;
    removeObject(ownerClusterId: string, bucket: string, objectKey: string): Promise<void>;
}

const MINIO_METADATA_PREFIX = 'x-amz-meta-';

const isObjectNotFoundError = (error: unknown): boolean => {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && (
            error.code === 'NotFound'
            || error.code === 'NoSuchKey'
        );
};

const normalizeMinioMetadata = (stat: MinioObjectStat): Record<string, string> => {
    const metadata: Record<string, string> = {};

    for (const [key, value] of Object.entries(stat.metaData ?? {})) {
        if (typeof value !== 'string') {
            continue;
        }

        if (!key.startsWith(MINIO_METADATA_PREFIX)) {
            continue;
        }

        metadata[key.slice(MINIO_METADATA_PREFIX.length).toLowerCase()] = value;
    }

    return metadata;
};

const toHeadResponse = (stat: MinioObjectStat): ClusterObjectHeadResponse => {
    const contentType = typeof stat.metaData?.['content-type'] === 'string'
        ? stat.metaData['content-type']
        : undefined;
    const contentEncoding = typeof stat.metaData?.['content-encoding'] === 'string'
        ? stat.metaData['content-encoding']
        : undefined;

    return {
        contentLength: typeof stat.size === 'number' ? stat.size : undefined,
        contentType,
        contentEncoding,
        etag: typeof stat.etag === 'string' ? stat.etag : undefined,
        lastModified: stat.lastModified instanceof Date ? stat.lastModified : undefined,
        metadata: normalizeMinioMetadata(stat)
    };
};

const requireLocalReadCapability = (
    runtimeConfig: DaemonRuntimeConfig,
    ownerClusterId: string
): void => {
    if (runtimeConfig.effectiveCapabilities.servesStorageReads) {
        return;
    }

    throw new Error(`Cluster ${ownerClusterId} is not allowed to serve authoritative storage reads locally`);
};

const requireLocalWriteCapability = (
    runtimeConfig: DaemonRuntimeConfig,
    ownerClusterId: string
): void => {
    if (runtimeConfig.effectiveCapabilities.acceptsStorageWrites) {
        return;
    }

    throw new Error(`Cluster ${ownerClusterId} is not allowed to accept authoritative storage writes locally`);
};

const inferContentType = (metadata?: Record<string, string>): string | undefined => {
    for (const [key, value] of Object.entries(metadata ?? {})) {
        if (key.toLowerCase() === 'content-type') {
            return value;
        }
    }

    return undefined;
};

const inferContentEncoding = (metadata?: Record<string, string>): string | undefined => {
    for (const [key, value] of Object.entries(metadata ?? {})) {
        if (key.toLowerCase() === 'content-encoding') {
            return value;
        }
    }

    return undefined;
};

const createScopedLocalMetadata = (metadata?: Record<string, string>): Record<string, string> => {
    const scopedMetadata: Record<string, string> = {};

    for (const [key, value] of Object.entries(metadata ?? {})) {
        if (key.toLowerCase() === 'content-type' || key.toLowerCase() === 'content-encoding') {
            continue;
        }

        scopedMetadata[`${MINIO_METADATA_PREFIX}${key.toLowerCase()}`] = value;
    }

    return scopedMetadata;
};

export const createClusterObjectStore = (deps: {
    config: DaemonConfig;
    minioService: MinioService;
    proxyClient: VoltServerObjectStoreProxyClient;
    getRuntimeSnapshot: () => DaemonRuntimeConfig;
}): ClusterObjectStore => {
    const isLocalOwner = (ownerClusterId: string): boolean => {
        return ownerClusterId === deps.config.teamClusterId;
    };

    const markRemoteFetch = (ownerClusterId: string, bucket: string, objectKey: string): void => {
        logger.info(
            {
                action: 'artifact.resolve.owner-fetch',
                ownerClusterId,
                bucket,
                objectKey
            },
            'Resolved remote owner object through Volt proxy'
        );
    };

    return {
        async head(ownerClusterId, bucket, objectKey) {
            if (isLocalOwner(ownerClusterId)) {
                requireLocalReadCapability(deps.getRuntimeSnapshot(), ownerClusterId);
                return toHeadResponse(await deps.minioService.statObject(bucket, objectKey) as MinioObjectStat);
            }

            markRemoteFetch(ownerClusterId, bucket, objectKey);
            return deps.proxyClient.head(ownerClusterId, bucket, objectKey);
        },

        async exists(ownerClusterId, bucket, objectKey) {
            try {
                await this.head(ownerClusterId, bucket, objectKey);
                return true;
            } catch (error) {
                if (isObjectNotFoundError(error) || (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 404)) {
                    return false;
                }

                throw error;
            }
        },

        async getStream(ownerClusterId, bucket, objectKey) {
            if (isLocalOwner(ownerClusterId)) {
                requireLocalReadCapability(deps.getRuntimeSnapshot(), ownerClusterId);
                const [stat, stream] = await Promise.all([
                    deps.minioService.statObject(bucket, objectKey) as Promise<MinioObjectStat>,
                    deps.minioService.getObjectStream(bucket, objectKey)
                ]);

                return {
                    ...toHeadResponse(stat),
                    stream
                };
            }

            markRemoteFetch(ownerClusterId, bucket, objectKey);
            return deps.proxyClient.getStream(ownerClusterId, bucket, objectKey);
        },

        async getBuffer(ownerClusterId, bucket, objectKey) {
            if (isLocalOwner(ownerClusterId)) {
                requireLocalReadCapability(deps.getRuntimeSnapshot(), ownerClusterId);
                const stream = await deps.minioService.getObjectStream(bucket, objectKey);
                const chunks: Buffer[] = [];
                for await (const chunk of stream) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }

                return Buffer.concat(chunks);
            }

            markRemoteFetch(ownerClusterId, bucket, objectKey);
            return deps.proxyClient.getBuffer(ownerClusterId, bucket, objectKey);
        },

        async putObject(input) {
            if (isLocalOwner(input.ownerClusterId)) {
                requireLocalWriteCapability(deps.getRuntimeSnapshot(), input.ownerClusterId);
                await deps.minioService.putObject({
                    bucket: input.bucket,
                    objectKey: input.objectKey,
                    body: input.body,
                    metadata: {
                        ...(inferContentType(input.metadata) ? { 'Content-Type': inferContentType(input.metadata)! } : {}),
                        ...(inferContentEncoding(input.metadata) ? { 'Content-Encoding': inferContentEncoding(input.metadata)! } : {}),
                        ...createScopedLocalMetadata(input.metadata)
                    }
                });
                return;
            }

            logger.info(
                {
                    action: 'artifact.write.remote',
                    ownerClusterId: input.ownerClusterId,
                    bucket: input.bucket,
                    objectKey: input.objectKey
                },
                'Writing object to remote owner cluster through Volt proxy'
            );

            await deps.proxyClient.putBuffer(input.ownerClusterId, {
                bucket: input.bucket,
                objectKey: input.objectKey,
                buffer: input.body,
                contentType: inferContentType(input.metadata),
                contentEncoding: inferContentEncoding(input.metadata),
                metadata: Object.fromEntries(
                    Object.entries(input.metadata ?? {}).filter(([key]) => !key.toLowerCase().startsWith('content-'))
                )
            });
        },

        async putObjectStream(input) {
            if (isLocalOwner(input.ownerClusterId)) {
                requireLocalWriteCapability(deps.getRuntimeSnapshot(), input.ownerClusterId);
                await deps.minioService.putObjectStream({
                    bucket: input.bucket,
                    objectKey: input.objectKey,
                    stream: input.stream,
                    size: input.size,
                    metadata: {
                        ...(inferContentType(input.metadata) ? { 'Content-Type': inferContentType(input.metadata)! } : {}),
                        ...(inferContentEncoding(input.metadata) ? { 'Content-Encoding': inferContentEncoding(input.metadata)! } : {}),
                        ...createScopedLocalMetadata(input.metadata)
                    }
                });
                return;
            }

            logger.info(
                {
                    action: 'artifact.write.remote',
                    ownerClusterId: input.ownerClusterId,
                    bucket: input.bucket,
                    objectKey: input.objectKey,
                    size: input.size
                },
                'Streaming object to remote owner cluster through Volt proxy'
            );

            await deps.proxyClient.putStream(input.ownerClusterId, {
                bucket: input.bucket,
                objectKey: input.objectKey,
                stream: input.stream,
                contentLength: input.size,
                contentType: inferContentType(input.metadata),
                contentEncoding: inferContentEncoding(input.metadata),
                metadata: Object.fromEntries(
                    Object.entries(input.metadata ?? {}).filter(([key]) => !key.toLowerCase().startsWith('content-'))
                )
            });
        },

        async list(ownerClusterId, request) {
            if (isLocalOwner(ownerClusterId)) {
                requireLocalReadCapability(deps.getRuntimeSnapshot(), ownerClusterId);
                return deps.minioService.listObjectsPage({
                    bucket: request.bucket,
                    prefix: request.prefix ?? '',
                    cursor: request.cursor,
                    limit: request.limit ?? 100
                });
            }

            return deps.proxyClient.list(ownerClusterId, request);
        },

        async deleteByPrefix(ownerClusterId, bucket, prefix) {
            if (isLocalOwner(ownerClusterId)) {
                requireLocalWriteCapability(deps.getRuntimeSnapshot(), ownerClusterId);
                return deps.minioService.deleteByPrefix(bucket, prefix);
            }

            logger.info(
                {
                    action: 'artifact.write.remote',
                    ownerClusterId,
                    bucket,
                    prefix
                },
                'Deleting remote owner prefix through Volt proxy'
            );
            return deps.proxyClient.deleteByPrefix(ownerClusterId, bucket, prefix);
        },

        async removeObject(ownerClusterId, bucket, objectKey) {
            if (isLocalOwner(ownerClusterId)) {
                requireLocalWriteCapability(deps.getRuntimeSnapshot(), ownerClusterId);
                await deps.minioService.removeObject(bucket, objectKey);
                return;
            }

            logger.info(
                {
                    action: 'artifact.write.remote',
                    ownerClusterId,
                    bucket,
                    objectKey
                },
                'Deleting remote owner object through Volt proxy'
            );
            await deps.proxyClient.deleteObject(ownerClusterId, bucket, objectKey);
        }
    };
};

export const createScopedClusterObjectStore = (
    objectStore: ClusterObjectStore,
    ownerClusterId: string
): {
    putObject(input: {
        bucket: string;
        objectKey: string;
        body: Buffer;
        metadata?: Record<string, string>;
    }): Promise<void>;
    putObjectStream(input: {
        bucket: string;
        objectKey: string;
        stream: Readable;
        size: number;
        metadata?: Record<string, string>;
    }): Promise<void>;
} => {
    return {
        putObject: (input) => objectStore.putObject({
            ...input,
            ownerClusterId
        }),
        putObjectStream: (input) => objectStore.putObjectStream({
            ...input,
            ownerClusterId
        })
    };
};
