import { logger } from '@/core/logger';
import type { DaemonConfig, DaemonRuntimeConfig } from '@/core/config';
import type { MinioService } from '@/modules/platform/services';
import type { Readable } from 'node:stream';
import type { TeamClusterDirectObjectStoreClient } from './TeamClusterDirectObjectStoreClient';

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

export interface ClusterObjectListEntry {
    key: string;
    contentLength?: number;
    etag?: string;
    lastModified?: Date;
}

export interface ClusterObjectReadOptions {
    skipMetadata?: boolean;
}

export interface ClusterObjectStore {
    head(ownerClusterId: string, bucket: string, objectKey: string): Promise<ClusterObjectHeadResponse>;
    getStream(
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        options?: ClusterObjectReadOptions
    ): Promise<ClusterObjectStreamResponse>;
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
    }): Promise<{ keys: string[]; objects: ClusterObjectListEntry[]; nextCursor?: string; }>;
}

const MINIO_METADATA_PREFIX = 'x-amz-meta-';

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
    remoteClient: TeamClusterDirectObjectStoreClient;
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
            'Resolved remote owner object through Volt server proxy'
        );
    };

    return {
        async head(ownerClusterId, bucket, objectKey) {
            if (isLocalOwner(ownerClusterId)) {
                requireLocalReadCapability(deps.getRuntimeSnapshot(), ownerClusterId);
                return toHeadResponse(await deps.minioService.statObject(bucket, objectKey) as MinioObjectStat);
            }

            markRemoteFetch(ownerClusterId, bucket, objectKey);
            return deps.remoteClient.head(ownerClusterId, bucket, objectKey);
        },

        async getStream(ownerClusterId, bucket, objectKey, options) {
            if (isLocalOwner(ownerClusterId)) {
                requireLocalReadCapability(deps.getRuntimeSnapshot(), ownerClusterId);
                if (options?.skipMetadata) {
                    const stream = await deps.minioService.getObjectStream(bucket, objectKey);
                    return {
                        metadata: {},
                        stream
                    };
                }

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
            return deps.remoteClient.getStream(ownerClusterId, bucket, objectKey, options);
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
                'Writing object to remote owner cluster through Volt server proxy'
            );

            await deps.remoteClient.putBuffer(input.ownerClusterId, {
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
                'Streaming object to remote owner cluster through Volt server proxy'
            );

            await deps.remoteClient.putStream(input.ownerClusterId, {
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

            return deps.remoteClient.list(ownerClusterId, request);
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
