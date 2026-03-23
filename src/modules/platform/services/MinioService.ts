import { logger } from '@/core/logger';
import { Client } from 'minio';
import type { DaemonConfig } from '@/core/config';
import type { Readable } from 'node:stream';
import type { BucketItem } from 'minio';

export interface PutObjectInput {
    bucket: string;
    objectKey: string;
    body: Buffer;
    metadata?: Record<string, string>;
};

export interface PutStreamInput {
    bucket: string;
    objectKey: string;
    stream: Readable;
    size: number;
    metadata?: Record<string, string>;
};

export interface ListObjectsPageInput {
    bucket: string;
    prefix: string;
    cursor?: string;
    limit: number;
};

export interface ListObjectsPageResult {
    keys: string[];
    nextCursor?: string;
};

export class MinioService {
    private readonly client: Client;
    private static readonly SAFE_LIST_PAGE_SIZE = 200;

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
    }

    async ensureBuckets(): Promise<void> {
        for (const bucket of this.config.allowedBuckets) {
            const exists = await this.client.bucketExists(bucket);
            if (!exists) {
                await this.client.makeBucket(bucket);
                logger.info(`Created MinIO bucket: ${bucket}`);
            }
        }
    }

    listBuckets(): string[] {
        return [...this.config.allowedBuckets];
    }

    getObjectStream(bucket: string, objectKey: string): Promise<Readable> {
        return this.client.getObject(bucket, objectKey);
    }

    statObject(bucket: string, objectKey: string) {
        return this.client.statObject(bucket, objectKey);
    }

    async putObject(input: PutObjectInput): Promise<void> {
        await this.client.putObject(input.bucket, input.objectKey, input.body, input.body.length, input.metadata);
    }

    async putObjectStream(input: PutStreamInput): Promise<void> {
        await this.client.putObject(input.bucket, input.objectKey, input.stream, input.size, input.metadata);
    }

    async listObjects(bucket: string, prefix: string, maxKeys?: number): Promise<string[]> {
        const requestedMaxKeys = typeof maxKeys === 'number' && Number.isInteger(maxKeys) && maxKeys > 0
            ? maxKeys
            : undefined;
        const keys: string[] = [];
        let continuationToken = '';

        do {
            const remainingKeys = requestedMaxKeys
                ? Math.max(0, requestedMaxKeys - keys.length)
                : MinioService.SAFE_LIST_PAGE_SIZE;
            if (requestedMaxKeys && remainingKeys === 0) {
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
                const key = this.readListItemKey(item);
                if (!key) {
                    continue;
                }

                keys.push(key);
                if (requestedMaxKeys && keys.length >= requestedMaxKeys) {
                    return keys;
                }
            }

            continuationToken = result.isTruncated
                ? result.nextContinuationToken
                : '';
        } while (continuationToken);

        return keys;
    }

    async listObjectsPage(input: ListObjectsPageInput): Promise<ListObjectsPageResult> {
        const requestedLimit = Number.isInteger(input.limit) && input.limit > 0
            ? input.limit
            : 100;
        const maxKeys = requestedLimit + 1;
        const collectedKeys: string[] = [];
        let continuationToken = '';
        let startAfter = input.cursor ?? '';

        while (collectedKeys.length < maxKeys) {
            const result = await this.client.listObjectsV2Query(
                input.bucket,
                input.prefix,
                continuationToken,
                '',
                Math.min(maxKeys - collectedKeys.length, MinioService.SAFE_LIST_PAGE_SIZE),
                startAfter
            );

            for (const item of result.objects) {
                const key = this.readListItemKey(item);
                if (!key) {
                    continue;
                }

                collectedKeys.push(key);
                if (collectedKeys.length >= maxKeys) {
                    return {
                        keys: collectedKeys.slice(0, requestedLimit),
                        nextCursor: collectedKeys[requestedLimit - 1]
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
            keys: collectedKeys
        };
    }

    async deleteByPrefix(bucket: string, prefix: string): Promise<number> {
        const BATCH_SIZE = 1000;
        let batch: string[] = [];
        let deletedCount = 0;
        let continuationToken = '';

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
                const key = this.readListItemKey(item);
                if (!key) {
                    continue;
                }

                batch.push(key);

                if (batch.length >= BATCH_SIZE) {
                    deletedCount += batch.length;
                    await this.client.removeObjects(bucket, batch);
                    batch = [];
                }
            }

            continuationToken = result.isTruncated
                ? result.nextContinuationToken
                : '';
        } while (continuationToken);

        if (batch.length > 0) {
            deletedCount += batch.length;
            await this.client.removeObjects(bucket, batch);
        }

        return deletedCount;
    }

    async removeObject(bucket: string, objectKey: string): Promise<void> {
        await this.client.removeObject(bucket, objectKey);
    }

    private readListItemKey(item: BucketItem): string | null {
        return 'name' in item && typeof item.name === 'string'
            ? item.name
            : null;
    }
};
