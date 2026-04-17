import { logger } from '@/core/logger';
import type { DaemonConfig, DaemonRuntimeConfig } from '@/core/config';
import type { Readable } from 'node:stream';

interface ClusterObjectHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

interface ClusterObjectStreamResponse extends ClusterObjectHeadResponse {
    stream: Readable;
}

interface ClusterObjectListEntry {
    key: string;
    contentLength?: number;
    etag?: string;
    lastModified?: Date;
}

interface ClusterObjectReadOptions {
    skipMetadata?: boolean;
}

interface ClusterObjectPutInput {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    body: Buffer;
    metadata?: Record<string, string>;
}

interface ClusterObjectPutStreamInput {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    stream: Readable;
    size: number;
    metadata?: Record<string, string>;
}

interface ClusterObjectListRequest {
    bucket: string;
    prefix: string;
    cursor?: string;
    limit?: number;
}

interface ClusterObjectListResponse {
    keys: string[];
    objects: ClusterObjectListEntry[];
    nextCursor?: string;
}

interface LocalClusterObjectStat {
    size: number;
    metaData: Record<string, string>;
    etag?: string;
    lastModified?: Date;
}

interface LocalClusterObjectPutRequest {
    bucket: string;
    objectKey: string;
    body: Buffer;
    metadata?: Record<string, string>;
}

interface LocalClusterObjectPutStreamRequest {
    bucket: string;
    objectKey: string;
    stream: Readable;
    size: number;
    metadata?: Record<string, string>;
}

interface LocalClusterObjectStoreGateway {
    statObject(bucket: string, objectKey: string): Promise<LocalClusterObjectStat>;
    getObjectStream(bucket: string, objectKey: string): Promise<Readable>;
    putObject(input: LocalClusterObjectPutRequest): Promise<void>;
    putObjectStream(input: LocalClusterObjectPutStreamRequest): Promise<void>;
    listObjectsPage(input: ClusterObjectListRequest): Promise<ClusterObjectListResponse>;
}

interface RemoteClusterObjectPutBufferRequest {
    bucket: string;
    objectKey: string;
    buffer: Buffer;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
}

interface RemoteClusterObjectPutStreamRequest {
    bucket: string;
    objectKey: string;
    stream: Readable;
    contentLength: number;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
}

interface RemoteClusterObjectStoreGateway {
    head(ownerClusterId: string, bucket: string, objectKey: string): Promise<ClusterObjectHeadResponse>;
    getStream(
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        options?: ClusterObjectReadOptions
    ): Promise<ClusterObjectStreamResponse>;
    putBuffer(ownerClusterId: string, request: RemoteClusterObjectPutBufferRequest): Promise<void>;
    putStream(ownerClusterId: string, request: RemoteClusterObjectPutStreamRequest): Promise<void>;
    list(ownerClusterId: string, request: ClusterObjectListRequest): Promise<ClusterObjectListResponse>;
}

interface ClusterObjectStoreDeps {
    config: DaemonConfig;
    minioService: LocalClusterObjectStoreGateway;
    remoteClient: RemoteClusterObjectStoreGateway;
    getRuntimeSnapshot: () => DaemonRuntimeConfig;
}

interface ScopedClusterObjectStore {
    putObject(input: Omit<ClusterObjectPutInput, 'ownerClusterId'>): Promise<void>;
    putObjectStream(input: Omit<ClusterObjectPutStreamInput, 'ownerClusterId'>): Promise<void>;
}

interface SplitObjectMetadataResult {
    contentType?: string;
    contentEncoding?: string;
    localMetadata: Record<string, string>;
    remoteMetadata: Record<string, string>;
}

export interface ClusterObjectStore {
    head(ownerClusterId: string, bucket: string, objectKey: string): Promise<ClusterObjectHeadResponse>;
    getStream(
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        options?: ClusterObjectReadOptions
    ): Promise<ClusterObjectStreamResponse>;
    putObject(input: ClusterObjectPutInput): Promise<void>;
    putObjectStream(input: ClusterObjectPutStreamInput): Promise<void>;
    list(ownerClusterId: string, request: ClusterObjectListRequest): Promise<ClusterObjectListResponse>;
}

class DefaultClusterObjectStore implements ClusterObjectStore {
    public constructor(private readonly deps: ClusterObjectStoreDeps) {}

    public readonly head = async (
        ownerClusterId: string,
        bucket: string,
        objectKey: string
    ): Promise<ClusterObjectHeadResponse> => {
        if (this.isLocalOwner(ownerClusterId)) {
            requireLocalReadCapability(this.deps.getRuntimeSnapshot(), ownerClusterId);
            return toHeadResponse(await this.deps.minioService.statObject(bucket, objectKey));
        }

        this.markRemoteFetch(ownerClusterId, bucket, objectKey);
        return this.deps.remoteClient.head(ownerClusterId, bucket, objectKey);
    };

    public readonly getStream = async (
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        options?: ClusterObjectReadOptions
    ): Promise<ClusterObjectStreamResponse> => {
        if (this.isLocalOwner(ownerClusterId)) {
            requireLocalReadCapability(this.deps.getRuntimeSnapshot(), ownerClusterId);
            if (options?.skipMetadata) {
                const stream = await this.deps.minioService.getObjectStream(bucket, objectKey);
                return {
                    metadata: {},
                    stream
                };
            }

            const [stat, stream] = await Promise.all([
                this.deps.minioService.statObject(bucket, objectKey),
                this.deps.minioService.getObjectStream(bucket, objectKey)
            ]);

            return {
                ...toHeadResponse(stat),
                stream
            };
        }

        this.markRemoteFetch(ownerClusterId, bucket, objectKey);
        return this.deps.remoteClient.getStream(ownerClusterId, bucket, objectKey, options);
    };

    public async putObject(input: ClusterObjectPutInput): Promise<void> {
        const metadata = splitObjectMetadata(input.metadata);

        if (this.isLocalOwner(input.ownerClusterId)) {
            requireLocalWriteCapability(this.deps.getRuntimeSnapshot(), input.ownerClusterId);
            await this.deps.minioService.putObject({
                bucket: input.bucket,
                objectKey: input.objectKey,
                body: input.body,
                metadata: metadata.localMetadata
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

        await this.deps.remoteClient.putBuffer(input.ownerClusterId, {
            bucket: input.bucket,
            objectKey: input.objectKey,
            buffer: input.body,
            contentType: metadata.contentType,
            contentEncoding: metadata.contentEncoding,
            metadata: metadata.remoteMetadata
        });
    }

    public async putObjectStream(input: ClusterObjectPutStreamInput): Promise<void> {
        const metadata = splitObjectMetadata(input.metadata);

        if (this.isLocalOwner(input.ownerClusterId)) {
            requireLocalWriteCapability(this.deps.getRuntimeSnapshot(), input.ownerClusterId);
            await this.deps.minioService.putObjectStream({
                bucket: input.bucket,
                objectKey: input.objectKey,
                stream: input.stream,
                size: input.size,
                metadata: metadata.localMetadata
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

        await this.deps.remoteClient.putStream(input.ownerClusterId, {
            bucket: input.bucket,
            objectKey: input.objectKey,
            stream: input.stream,
            contentLength: input.size,
            contentType: metadata.contentType,
            contentEncoding: metadata.contentEncoding,
            metadata: metadata.remoteMetadata
        });
    }

    public readonly list = (
        ownerClusterId: string,
        request: ClusterObjectListRequest
    ): Promise<ClusterObjectListResponse> => {
        if (this.isLocalOwner(ownerClusterId)) {
            requireLocalReadCapability(this.deps.getRuntimeSnapshot(), ownerClusterId);
            return this.deps.minioService.listObjectsPage({
                bucket: request.bucket,
                prefix: request.prefix,
                cursor: request.cursor,
                limit: request.limit ?? 100
            });
        }

        return this.deps.remoteClient.list(ownerClusterId, request);
    };

    private isLocalOwner(ownerClusterId: string): boolean {
        return ownerClusterId === this.deps.config.teamClusterId;
    }

    private markRemoteFetch(ownerClusterId: string, bucket: string, objectKey: string): void {
        logger.info(
            {
                action: 'artifact.resolve.owner-fetch',
                ownerClusterId,
                bucket,
                objectKey
            },
            'Resolved remote owner object through Volt server proxy'
        );
    }
}

const MINIO_METADATA_PREFIX = 'x-amz-meta-';

const toHeadResponse = (stat: LocalClusterObjectStat): ClusterObjectHeadResponse => {
    const metadata: Record<string, string> = {};

    for (const [key, value] of Object.entries(stat.metaData)) {
        if (!key.startsWith(MINIO_METADATA_PREFIX)) {
            continue;
        }

        metadata[key.slice(MINIO_METADATA_PREFIX.length).toLowerCase()] = value;
    }

    return {
        contentLength: stat.size,
        contentType: stat.metaData['content-type'],
        contentEncoding: stat.metaData['content-encoding'],
        etag: stat.etag,
        lastModified: stat.lastModified,
        metadata
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

const splitObjectMetadata = (metadata?: Record<string, string>): SplitObjectMetadataResult => {
    const localMetadata: Record<string, string> = {};
    const remoteMetadata: Record<string, string> = {};
    let contentType: string | undefined;
    let contentEncoding: string | undefined;

    if (!metadata) {
        return {
            contentType,
            contentEncoding,
            localMetadata,
            remoteMetadata
        };
    }

    for (const [key, value] of Object.entries(metadata)) {
        const normalizedKey = key.toLowerCase();

        if (normalizedKey === 'content-type') {
            contentType = value;
            continue;
        }

        if (normalizedKey === 'content-encoding') {
            contentEncoding = value;
            continue;
        }

        localMetadata[`${MINIO_METADATA_PREFIX}${normalizedKey}`] = value;
        remoteMetadata[key] = value;
    }

    return {
        contentType,
        contentEncoding,
        localMetadata: {
            ...(contentType ? { 'Content-Type': contentType } : {}),
            ...(contentEncoding ? { 'Content-Encoding': contentEncoding } : {}),
            ...localMetadata
        },
        remoteMetadata
    };
};

export const createClusterObjectStore = (deps: ClusterObjectStoreDeps): ClusterObjectStore => {
    return new DefaultClusterObjectStore(deps);
};

export const createScopedClusterObjectStore = (
    objectStore: ClusterObjectStore,
    ownerClusterId: string
): ScopedClusterObjectStore => {
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
