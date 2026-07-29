import { singleton } from '@shared/application/utilities/singleton';
import Bottleneck from 'bottleneck';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import { Client, CopyDestinationOptions, CopySourceOptions } from 'minio';
import type { DaemonConfig } from '@core/config/daemon';
import type { BucketItem } from 'minio';
import type {
    ClusterObjectListEntry,
    ClusterObjectListResponse,
    LocalClusterObjectComposeInput,
    LocalClusterObjectListRequest,
    LocalClusterObjectStat,
    LocalClusterObjectStoreGateway,
    ScopedClusterObjectPutInput,
    ScopedClusterObjectPutStreamInput
} from '@shared/contracts/types/cluster-object-store';

export class MinioService implements LocalClusterObjectStoreGateway {
    private readonly client: Client;
    private readonly bucketPrefix: string;
    private static readonly SAFE_LIST_PAGE_SIZE = 200;
    readonly ensureBuckets: () => Promise<void>;
    readonly listBuckets: () => string[];
    readonly getObjectStream: LocalClusterObjectStoreGateway['getObjectStream'];
    readonly getObjectRangeStream: LocalClusterObjectStoreGateway['getObjectRangeStream'];
    readonly statObject: (bucket: string, objectKey: string) => Promise<LocalClusterObjectStat>;
    readonly putObject: (input: ScopedClusterObjectPutInput) => Promise<void>;
    readonly putObjectStream: (input: ScopedClusterObjectPutStreamInput) => Promise<void>;
    readonly composeObject: (input: LocalClusterObjectComposeInput) => Promise<void>;
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

        this.bucketPrefix = this.config.bucketPrefix ?? '';

        this.listBuckets = () => [...this.config.allowedBuckets];
        this.ensureBuckets = async () => {
            for (const bucket of this.listBuckets()) {
                const resolvedBucket = this.resolveBucket(bucket);
                const exists = await this.client.bucketExists(resolvedBucket);
                if (!exists) {
                    await this.client.makeBucket(resolvedBucket);
                    logger.info(`Created MinIO bucket: ${resolvedBucket}`);
                }
            }
        };
        this.getObjectStream = (bucket, objectKey) => this.client.getObject(this.resolveBucket(bucket), objectKey);
        this.getObjectRangeStream = (bucket, objectKey, offset, length) => (
            this.client.getPartialObject(this.resolveBucket(bucket), objectKey, offset, length)
        );
        this.statObject = (bucket, objectKey) => this.client.statObject(this.resolveBucket(bucket), objectKey);
        this.putObject = async (input) => {
            await this.client.putObject(this.resolveBucket(input.bucket), input.objectKey, input.body, input.body.length, input.metadata);
        };
        this.putObjectStream = async (input) => {
            await this.client.putObject(this.resolveBucket(input.bucket), input.objectKey, input.stream, input.size, input.metadata);
        };
        this.composeObject = async (input) => {
            const resolvedBucket = this.resolveBucket(input.bucket);
            const destination = new CopyDestinationOptions({
                Bucket: resolvedBucket,
                Object: input.objectKey,
                ...(input.metadata ? { UserMetadata: input.metadata } : {})
            });
            const sources = input.sourceObjectKeys.map((objectKey) => new CopySourceOptions({
                Bucket: resolvedBucket,
                Object: objectKey
            }));

            await this.client.composeObject(destination, sources);
        };
        this.removeObject = async (bucket, objectKey) => {
            await this.client.removeObject(this.resolveBucket(bucket), objectKey);
        };
    }

    private resolveBucket(bucket: string): string {
        if (!this.bucketPrefix) return bucket;
        if (bucket.startsWith(this.bucketPrefix)) return bucket;
        return `${this.bucketPrefix}${bucket}`;
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
                this.resolveBucket(bucket),
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
        let startAfter = input.cursor ?? '';

        while (collectedObjects.length < maxKeys) {
            const result = await this.client.listObjectsV2Query(
                this.resolveBucket(input.bucket),
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

        // Bottleneck admits on first completion, where the previous hand-rolled
        // `inFlight.shift()` drained head-of-line, so one slow batch stalled the
        // whole window. The count is also only incremented once the delete has
        // actually resolved — it used to be added up front, so a failed batch
        // was still reported as deleted.
        const limiter = new Bottleneck({ maxConcurrent: MAX_INFLIGHT_BATCHES });
        const resolvedBucket = this.resolveBucket(bucket);
        const inFlight: Promise<void>[] = [];

        const submitBatch = (keys: string[]): void => {
            inFlight.push(limiter.schedule(async () => {
                await this.client.removeObjects(resolvedBucket, keys);
                deletedCount += keys.length;
            }));
        };

        do {
            const result = await this.client.listObjectsV2Query(
                resolvedBucket,
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
                    submitBatch(toSubmit);
                }
            }

            continuationToken = result.isTruncated
                ? result.nextContinuationToken
                : '';
        } while (continuationToken);

        if (batch.length > 0) {
            submitBatch(batch);
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
}

export const getMinioService = singleton((): MinioService => new MinioService(getConfig()));
