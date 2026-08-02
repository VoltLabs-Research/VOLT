import { singleton } from '@shared/application/utilities/singleton';
import Bottleneck from 'bottleneck';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import { Client, CopyDestinationOptions, CopySourceOptions } from 'minio';
import type { DaemonConfig } from '@core/config/daemon';
import type { Readable } from 'node:stream';
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

const SAFE_LIST_PAGE_SIZE = 200;
const DELETE_BATCH_SIZE = 1000;
const MAX_INFLIGHT_DELETE_BATCHES = 4;

export class MinioService implements LocalClusterObjectStoreGateway {
    private readonly client: Client;
    private readonly bucketPrefix: string;

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
    }

    /** An empty prefix makes `startsWith` trivially true, so unprefixed buckets pass through. */
    private resolveBucket(bucket: string): string {
        return bucket.startsWith(this.bucketPrefix) ? bucket : `${this.bucketPrefix}${bucket}`;
    }

    listBuckets(): string[] {
        return [...this.config.allowedBuckets];
    }

    async ensureBuckets(): Promise<void> {
        for (const bucket of this.listBuckets()) {
            const resolvedBucket = this.resolveBucket(bucket);
            if (!(await this.client.bucketExists(resolvedBucket))) {
                await this.client.makeBucket(resolvedBucket);
                logger.info(`Created MinIO bucket: ${resolvedBucket}`);
            }
        }
    }

    getObjectStream(bucket: string, objectKey: string): Promise<Readable> {
        return this.client.getObject(this.resolveBucket(bucket), objectKey);
    }

    getObjectRangeStream(bucket: string, objectKey: string, offset: number, length: number): Promise<Readable> {
        return this.client.getPartialObject(this.resolveBucket(bucket), objectKey, offset, length);
    }

    statObject(bucket: string, objectKey: string): Promise<LocalClusterObjectStat> {
        return this.client.statObject(this.resolveBucket(bucket), objectKey);
    }

    async putObject(input: ScopedClusterObjectPutInput): Promise<void> {
        await this.client.putObject(this.resolveBucket(input.bucket), input.objectKey, input.body, input.body.length, input.metadata);
    }

    async putObjectStream(input: ScopedClusterObjectPutStreamInput): Promise<void> {
        await this.client.putObject(this.resolveBucket(input.bucket), input.objectKey, input.stream, input.size, input.metadata);
    }

    async composeObject(input: LocalClusterObjectComposeInput): Promise<void> {
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
    }

    async removeObject(bucket: string, objectKey: string): Promise<void> {
        await this.client.removeObject(this.resolveBucket(bucket), objectKey);
    }

    /** Walks every object under `prefix` in lexicographic order, page by page. */
    private async *iterateObjects(bucket: string, prefix: string, startAfter = ''): AsyncGenerator<ClusterObjectListEntry> {
        const resolvedBucket = this.resolveBucket(bucket);
        let continuationToken = '';
        let cursor = startAfter;

        do {
            const result = await this.client.listObjectsV2Query(
                resolvedBucket,
                prefix,
                continuationToken,
                '',
                SAFE_LIST_PAGE_SIZE,
                cursor
            );

            for (const item of result.objects) {
                // A prefix "directory" entry carries no name and is not an object.
                if (item.name === undefined) {
                    continue;
                }

                yield {
                    key: item.name,
                    contentLength: item.size,
                    etag: item.etag,
                    lastModified: item.lastModified
                };
            }

            cursor = '';
            continuationToken = result.isTruncated
                ? result.nextContinuationToken
                : '';
        } while (continuationToken);
    }

    async listObjects(bucket: string, prefix: string): Promise<string[]> {
        const keys: string[] = [];
        for await (const object of this.iterateObjects(bucket, prefix)) {
            keys.push(object.key);
        }
        return keys;
    }

    async listObjectsPage(input: LocalClusterObjectListRequest): Promise<ClusterObjectListResponse> {
        const collected: ClusterObjectListEntry[] = [];

        // One object past the page proves another page exists and names its cursor.
        for await (const object of this.iterateObjects(input.bucket, input.prefix, input.cursor ?? '')) {
            collected.push(object);
            if (collected.length > input.limit) {
                break;
            }
        }

        const objects = collected.slice(0, input.limit);
        return {
            keys: objects.map((object) => object.key),
            objects,
            nextCursor: collected.length > input.limit
                ? objects[input.limit - 1].key
                : undefined
        };
    }

    async deleteByPrefix(bucket: string, prefix: string): Promise<number> {
        // Bottleneck admits on first completion, so one slow batch cannot stall the
        // window. The count only advances once a delete has actually resolved.
        const limiter = new Bottleneck({ maxConcurrent: MAX_INFLIGHT_DELETE_BATCHES });
        const resolvedBucket = this.resolveBucket(bucket);
        const inFlight: Promise<void>[] = [];
        let deletedCount = 0;
        let batch: string[] = [];

        const submitBatch = (keys: string[]): void => {
            inFlight.push(limiter.schedule(async () => {
                await this.client.removeObjects(resolvedBucket, keys);
                deletedCount += keys.length;
            }));
        };

        for await (const object of this.iterateObjects(bucket, prefix)) {
            batch.push(object.key);

            if (batch.length >= DELETE_BATCH_SIZE) {
                submitBatch(batch);
                batch = [];
            }
        }

        if (batch.length > 0) {
            submitBatch(batch);
        }

        await Promise.all(inFlight);
        return deletedCount;
    }
}

export const getMinioService = singleton((): MinioService => new MinioService(getConfig()));
