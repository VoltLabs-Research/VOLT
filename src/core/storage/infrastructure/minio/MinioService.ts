import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { Client } from 'minio';
import type { DaemonConfig } from '@/core/config';
import type { BucketItem } from 'minio';
import type {
    ClusterObjectListEntry,
    ClusterObjectListResponse,
    LocalClusterObjectListRequest,
    LocalClusterObjectStat,
    LocalClusterObjectStoreGateway,
    ScopedClusterObjectPutInput,
    ScopedClusterObjectPutStreamInput
} from '@/core/storage/contracts/cluster-object-store';

@Service('minioService')
export class MinioService implements LocalClusterObjectStoreGateway {
    private readonly client: Client;
    private static readonly SAFE_LIST_PAGE_SIZE = 200;
    readonly ensureBuckets: () => Promise<void>;
    readonly listBuckets: () => string[];
    readonly getObjectStream: LocalClusterObjectStoreGateway['getObjectStream'];
    readonly getObjectRangeStream: LocalClusterObjectStoreGateway['getObjectRangeStream'];
    readonly statObject: (bucket: string, objectKey: string) => Promise<LocalClusterObjectStat>;
    readonly putObject: (input: ScopedClusterObjectPutInput) => Promise<void>;
    readonly putObjectStream: (input: ScopedClusterObjectPutStreamInput) => Promise<void>;
    readonly removeObject: (bucket: string, objectKey: string) => Promise<void>;

    constructor(
        private readonly config: DaemonConfig
    ) {
        const minioUrl = new URL(config.minio.endpoint);
        this.client = new Client({
            endPoint: minioUrl.hostname,
            port: Number(minioUrl.port || (minioUrl.protocol === 'https:' ? 443 : 80)),
            useSSL: minioUrl.protocol === 'https:' || config.minio.useSSL,
            accessKey: config.minio.accessKey,
            secretKey: config.minio.secretKey
        });

        this.listBuckets = () => [...this.config.allowedBuckets];
        this.ensureBuckets = async () => {
            for (const bucket of this.listBuckets()) {
                const exists = await this.client.bucketExists(bucket);
                if (!exists) {
                    await this.client.makeBucket(bucket);
                    logger.info(`Created MinIO bucket: ${bucket}`);
                }
            }
        };
        this.getObjectStream = (bucket, objectKey) => this.client.getObject(bucket, objectKey);
        this.getObjectRangeStream = (bucket, objectKey, offset, length) => (
            this.client.getPartialObject(bucket, objectKey, offset, length)
        );
        this.statObject = (bucket, objectKey) => this.client.statObject(bucket, objectKey);
        this.putObject = async (input) => {
            await this.client.putObject(input.bucket, input.objectKey, input.body, input.body.length, input.metadata);
        };
        this.putObjectStream = async (input) => {
            await this.client.putObject(input.bucket, input.objectKey, input.stream, input.size, input.metadata);
        };
        this.removeObject = async (bucket, objectKey) => {
            await this.client.removeObject(bucket, objectKey);
        };
    }

    async listObjects(bucket: string, prefix: string, maxKeys?: number): Promise<string[]> {
        const keys: string[] = [];
        let continuationToken = '';

        do {
            const remainingKeys = maxKeys === undefined
                ? MinioService.SAFE_LIST_PAGE_SIZE
                : Math.max(0, maxKeys - keys.length);
            if (maxKeys !== undefined && remainingKeys === 0) {
                break;
            }

            const result = await this.client.listObjectsV2Query(
                bucket,
                prefix,
                continuationToken,
                '',
                Math.min(remainingKeys, MinioService.SAFE_LIST_PAGE_SIZE),
                ''
            );

            for (const item of result.objects) {
                const listedObject = this.readListItem(item);
                if (!listedObject) {
                    continue;
                }

                keys.push(listedObject.key);
                if (maxKeys !== undefined && keys.length >= maxKeys) {
                    return keys;
                }
            }

            continuationToken = result.isTruncated
                ? result.nextContinuationToken
                : '';
        } while (continuationToken);

        return keys;
    }

    async listObjectsPage(input: LocalClusterObjectListRequest): Promise<ClusterObjectListResponse> {
        const requestedLimit = input.limit;
        const maxKeys = requestedLimit + 1;
        const collectedObjects: ClusterObjectListEntry[] = [];
        let continuationToken = '';
        let startAfter = input.cursor;
        if (startAfter === undefined) {
            startAfter = '';
        }

        while (collectedObjects.length < maxKeys) {
            const result = await this.client.listObjectsV2Query(
                input.bucket,
                input.prefix,
                continuationToken,
                '',
                Math.min(maxKeys - collectedObjects.length, MinioService.SAFE_LIST_PAGE_SIZE),
                startAfter
            );

            for (const item of result.objects) {
                const listedObject = this.readListItem(item);
                if (!listedObject) {
                    continue;
                }

                collectedObjects.push(listedObject);
                if (collectedObjects.length >= maxKeys) {
                    const objects = collectedObjects.slice(0, requestedLimit);
                    return {
                        keys: objects.map((object) => object.key),
                        objects,
                        nextCursor: objects[requestedLimit - 1].key
                    };
                }
            }

            if (!result.isTruncated) {
                break;
            }

            continuationToken = result.nextContinuationToken;
            startAfter = '';
        }

        return {
            keys: collectedObjects.map((object) => object.key),
            objects: collectedObjects
        };
    }

    async deleteByPrefix(bucket: string, prefix: string): Promise<number> {
        const BATCH_SIZE = 1000;
        const MAX_INFLIGHT_BATCHES = 4;
        let batch: string[] = [];
        let deletedCount = 0;
        let continuationToken = '';
        const inFlight: Promise<void>[] = [];

        const drainInFlight = async (minFree: number): Promise<void> => {
            while (inFlight.length >= MAX_INFLIGHT_BATCHES - minFree + 1 && inFlight.length > 0) {
                await inFlight.shift();
            }
        };

        const submitBatch = async (keys: string[]): Promise<void> => {
            deletedCount += keys.length;
            const task = this.client.removeObjects(bucket, keys).then(() => undefined);
            inFlight.push(task);
            await drainInFlight(1);
        };

        do {
            const result = await this.client.listObjectsV2Query(
                bucket,
                prefix,
                continuationToken,
                '',
                MinioService.SAFE_LIST_PAGE_SIZE,
                ''
            );

            for (const item of result.objects) {
                const listedObject = this.readListItem(item);
                if (!listedObject) {
                    continue;
                }

                batch.push(listedObject.key);

                if (batch.length >= BATCH_SIZE) {
                    const toSubmit = batch;
                    batch = [];
                    await submitBatch(toSubmit);
                }
            }

            continuationToken = result.isTruncated
                ? result.nextContinuationToken
                : '';
        } while (continuationToken);

        if (batch.length > 0) {
            await submitBatch(batch);
        }

        await Promise.all(inFlight);
        return deletedCount;
    }

    private readListItem(item: BucketItem): ClusterObjectListEntry | null {
        if (item.name === undefined) {
            return null;
        }

        return {
            key: item.name,
            contentLength: item.size,
            etag: item.etag,
            lastModified: item.lastModified
        };
    }
};
