import type { DaemonConfig } from '@/core/config';
import { Factory } from '@/core/decorators/service';
import type {
    ClusterObjectHeadResponse,
    ClusterObjectListEntry,
    ClusterObjectListRequest,
    ClusterObjectListResponse,
    ClusterObjectPutInput,
    ClusterObjectPutStreamInput,
    ClusterObjectReadOptions,
    ClusterObjectStore,
    ClusterObjectStreamResponse,
    LocalClusterObjectStat,
    LocalClusterObjectStoreGateway,
    RemoteClusterObjectPutBufferRequest,
    RemoteClusterObjectPutStreamRequest,
    RemoteClusterObjectStoreGateway,
    ScopedClusterObjectPutInput,
    ScopedClusterObjectPutStreamInput,
    ScopedClusterObjectStore
} from '@/core/storage/contracts/cluster-object-store';

interface ClusterObjectStoreDeps {
    config: DaemonConfig;
    minioService: LocalClusterObjectStoreGateway;
    remoteClient: RemoteClusterObjectStoreGateway;
}

interface SplitObjectMetadataResult {
    contentType?: string;
    contentEncoding?: string;
    localMetadata: Record<string, string>;
    remoteMetadata: Record<string, string>;
}

export type {
    ClusterObjectHeadResponse,
    ClusterObjectListEntry,
    ClusterObjectListRequest,
    ClusterObjectListResponse,
    ClusterObjectPutInput,
    ClusterObjectPutStreamInput,
    ClusterObjectReadOptions,
    ClusterObjectStore,
    ClusterObjectStreamResponse,
    ScopedClusterObjectPutInput,
    ScopedClusterObjectPutStreamInput,
    ScopedClusterObjectStore
} from '@/core/storage/contracts/cluster-object-store';

class DefaultClusterObjectStore implements ClusterObjectStore {
    public constructor(private readonly deps: ClusterObjectStoreDeps) {}

    public readonly head = async (
        ownerClusterId: string,
        bucket: string,
        objectKey: string
    ): Promise<ClusterObjectHeadResponse> => {
        if (this.isLocalOwner(ownerClusterId)) {
            return toHeadResponse(await this.deps.minioService.statObject(bucket, objectKey));
        }
        return this.deps.remoteClient.head(ownerClusterId, bucket, objectKey);
    };

    public readonly getStream = async (
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        options?: ClusterObjectReadOptions
    ): Promise<ClusterObjectStreamResponse> => {
        if (this.isLocalOwner(ownerClusterId)) {
            const range = options?.range;
            if (options?.skipMetadata) {
                const stream = range
                    ? await this.deps.minioService.getObjectRangeStream(bucket, objectKey, range.offset, range.length)
                    : await this.deps.minioService.getObjectStream(bucket, objectKey);
                return {
                    metadata: {},
                    stream
                };
            }

            const [stat, stream] = await Promise.all([
                this.deps.minioService.statObject(bucket, objectKey),
                range
                    ? this.deps.minioService.getObjectRangeStream(bucket, objectKey, range.offset, range.length)
                    : this.deps.minioService.getObjectStream(bucket, objectKey)
            ]);

            return {
                ...toHeadResponse(stat),
                stream
            };
        }
        return this.deps.remoteClient.getStream(ownerClusterId, bucket, objectKey, options);
    };

    public async putObject(input: ClusterObjectPutInput): Promise<void> {
        const metadata = splitObjectMetadata(input.metadata);

        if (this.isLocalOwner(input.ownerClusterId)) {
            await this.deps.minioService.putObject({
                bucket: input.bucket,
                objectKey: input.objectKey,
                body: input.body,
                metadata: metadata.localMetadata
            });
            return;
        }

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
            await this.deps.minioService.putObjectStream({
                bucket: input.bucket,
                objectKey: input.objectKey,
                stream: input.stream,
                size: input.size,
                metadata: metadata.localMetadata
            });
            return;
        }

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

export const provideClusterObjectStore = Factory('objectStore')((
    config: DaemonConfig,
    minioService: LocalClusterObjectStoreGateway,
    remoteClient: RemoteClusterObjectStoreGateway
): ClusterObjectStore => createClusterObjectStore({ config, minioService, remoteClient }));

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
