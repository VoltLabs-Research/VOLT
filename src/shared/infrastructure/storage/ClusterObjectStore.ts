import { singleton } from '@shared/application/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import { getMinioService } from '@shared/infrastructure/storage/MinioService';
import { getRemoteClient } from '@shared/infrastructure/storage/DirectObjectStoreClient';
import type { DaemonConfig } from '@core/config/daemon';
import type {
    ClusterObjectHeadResponse,
    ClusterObjectStore,
    LocalClusterObjectStat,
    LocalClusterObjectStoreGateway,
    RemoteClusterObjectStoreGateway,
    ScopedClusterObjectStore
} from '@shared/contracts/types/cluster-object-store';

export type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';

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

/** Splits caller metadata into minio's `x-amz-meta-*` form and the proxy's plain form. */
const splitObjectMetadata = (metadata?: Record<string, string>) => {
    const localMetadata: Record<string, string> = {};
    const remoteMetadata: Record<string, string> = {};
    let contentType: string | undefined;
    let contentEncoding: string | undefined;

    for (const [key, value] of Object.entries(metadata ?? {})) {
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

const createClusterObjectStore = (
    config: DaemonConfig,
    minioService: LocalClusterObjectStoreGateway,
    remoteClient: RemoteClusterObjectStoreGateway
): ClusterObjectStore => {
    const isLocalOwner = (ownerClusterId: string): boolean => ownerClusterId === config.teamClusterId;

    return {
        head: async (ownerClusterId, bucket, objectKey) => {
            if (!isLocalOwner(ownerClusterId)) {
                return remoteClient.head(ownerClusterId, bucket, objectKey);
            }

            return toHeadResponse(await minioService.statObject(bucket, objectKey));
        },

        getStream: async (ownerClusterId, bucket, objectKey, options) => {
            if (!isLocalOwner(ownerClusterId)) {
                return remoteClient.getStream(ownerClusterId, bucket, objectKey, options);
            }

            const range = options?.range;
            const readStream = () => (range
                ? minioService.getObjectRangeStream(bucket, objectKey, range.offset, range.length)
                : minioService.getObjectStream(bucket, objectKey));

            if (options?.skipMetadata) {
                return {
                    metadata: {},
                    stream: await readStream()
                };
            }

            const [stat, stream] = await Promise.all([
                minioService.statObject(bucket, objectKey),
                readStream()
            ]);

            return {
                ...toHeadResponse(stat),
                stream
            };
        },

        putObject: async (input) => {
            const metadata = splitObjectMetadata(input.metadata);

            if (isLocalOwner(input.ownerClusterId)) {
                await minioService.putObject({
                    bucket: input.bucket,
                    objectKey: input.objectKey,
                    body: input.body,
                    metadata: metadata.localMetadata
                });
                return;
            }

            await remoteClient.putBuffer(input.ownerClusterId, {
                bucket: input.bucket,
                objectKey: input.objectKey,
                buffer: input.body,
                contentType: metadata.contentType,
                contentEncoding: metadata.contentEncoding,
                metadata: metadata.remoteMetadata
            });
        },

        putObjectStream: async (input) => {
            const metadata = splitObjectMetadata(input.metadata);

            if (isLocalOwner(input.ownerClusterId)) {
                await minioService.putObjectStream({
                    bucket: input.bucket,
                    objectKey: input.objectKey,
                    stream: input.stream,
                    size: input.size,
                    metadata: metadata.localMetadata
                });
                return;
            }

            await remoteClient.putStream(input.ownerClusterId, {
                bucket: input.bucket,
                objectKey: input.objectKey,
                stream: input.stream,
                contentLength: input.size,
                contentType: metadata.contentType,
                contentEncoding: metadata.contentEncoding,
                metadata: metadata.remoteMetadata
            });
        },

        list: (ownerClusterId, request) => {
            if (!isLocalOwner(ownerClusterId)) {
                return remoteClient.list(ownerClusterId, request);
            }

            return minioService.listObjectsPage({
                bucket: request.bucket,
                prefix: request.prefix,
                cursor: request.cursor,
                limit: request.limit ?? 100
            });
        }
    };
};

export const getObjectStore = singleton((): ClusterObjectStore =>
    createClusterObjectStore(getConfig(), getMinioService(), getRemoteClient()));

export const createScopedClusterObjectStore = (
    objectStore: ClusterObjectStore,
    ownerClusterId: string
): ScopedClusterObjectStore => ({
    putObject: (input) => objectStore.putObject({
 ...input, ownerClusterId 
}),
    putObjectStream: (input) => objectStore.putObjectStream({
 ...input, ownerClusterId 
})
});
