import { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import { RemoteExplorerContentType, RemoteExplorerEntryType, RemoteExplorerNodeType, RemoteExplorerTarget } from '@/contracts';
import type { ReverseChannelCommandResult } from '@/core/reverse-channel/contracts/reverse-channel-messaging';
import type { RemoteExplorerEntry, RemoteExplorerNode } from '@/contracts';
import { MAX_OBJECT_PREVIEW_BYTES, buildAttachmentContentDisposition, joinExplorerPathSegments, normalizeExplorerPath } from '@/modules/container/infrastructure/remote-access/shared';
import { parseMinioPath, splitExplorerPathSegments, toWebReadableStream } from '@/modules/container/infrastructure/remote-access/shared';
import BaseRemoteAccess from '@/modules/container/infrastructure/remote-access/BaseRemoteAccess';

interface MinioLikeError {
    code?: string;
};

export default class MinioRemoteAccess extends BaseRemoteAccess {
    readonly target = RemoteExplorerTarget.Minio;

    constructor(
        private readonly minioService: MinioService
    ) {
        super();
    }

    async list(path: string): Promise<RemoteExplorerEntry[]> {
        const normalizedPath = normalizeExplorerPath(path);
        if (!normalizedPath) {
            return this.minioService.listBuckets().map((bucket) => ({
                id: bucket,
                name: bucket,
                path: bucket,
                type: RemoteExplorerEntryType.Bucket,
                size: null,
                updatedAt: null,
                description: 'Bucket'
            }));
        }

        const parsedPath = parseMinioPath(normalizedPath);
        if (!parsedPath || !this.minioService.listBuckets().includes(parsedPath.bucket)) {
            return [];
        }

        const prefixSegments = splitExplorerPathSegments(parsedPath.objectKey);
        const prefix = prefixSegments.join('/');
        const effectivePrefix = prefix ? `${prefix.replace(/\/+$/g, '')}/` : '';
        const objectKeys = await this.minioService.listObjects(parsedPath.bucket, effectivePrefix);
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
                const childPath = joinExplorerPathSegments(parsedPath.bucket, effectivePrefix, directoryName);

                if (!entries.has(childPath)) {
                    entries.set(childPath, {
                        id: childPath,
                        name: directoryName,
                        path: childPath,
                        type: RemoteExplorerEntryType.Directory,
                        size: null,
                        updatedAt: null,
                        description: 'Directory'
                    });
                }
                continue;
            }

            const childPath = joinExplorerPathSegments(parsedPath.bucket, effectivePrefix, remainder);
            entries.set(childPath, {
                id: childPath,
                name: remainder,
                path: childPath,
                type: RemoteExplorerEntryType.Object,
                size: null,
                updatedAt: null,
                description: 'Object'
            });
        }

        return Array.from(entries.values()).sort((left, right) => left.name.localeCompare(right.name));
    }

    async node(path: string): Promise<RemoteExplorerNode> {
        const normalizedPath = normalizeExplorerPath(path);
        const parsedPath = parseMinioPath(normalizedPath);

        if (!parsedPath || !parsedPath.objectKey || !this.minioService.listBuckets().includes(parsedPath.bucket)) {
            return {
                path,
                title: parsedPath?.bucket ?? 'MinIO',
                type: RemoteExplorerNodeType.Object,
                contentType: RemoteExplorerContentType.Empty,
                textContent: null,
                mongoDocuments: []
            };
        }

        const { bucket, objectKey } = parsedPath;

        const stream = await this.minioService.getObjectStream(bucket, objectKey);
        const chunks: Buffer[] = [];
        let totalBytes = 0;

        try {
            for await (const chunk of stream as AsyncIterable<Buffer>) {
                const remaining = MAX_OBJECT_PREVIEW_BYTES - totalBytes;
                if (remaining <= 0) {
                    break;
                }
                const safeChunk = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
                chunks.push(safeChunk);
                totalBytes += safeChunk.length;

                if (totalBytes >= MAX_OBJECT_PREVIEW_BYTES) {
                    break;
                }
            }
        } finally {
            stream.destroy();
        }

        return {
            path,
            title: objectKey,
            type: RemoteExplorerNodeType.Object,
            contentType: RemoteExplorerContentType.Text,
            textContent: Buffer.concat(chunks).toString('utf-8'),
            mongoDocuments: []
        };
    }

    async download(path: string): Promise<ReverseChannelCommandResult> {
        const normalizedPath = normalizeExplorerPath(path);
        const parsedPath = parseMinioPath(normalizedPath);

        if (!parsedPath) {
            throw new Error('MinIO download requires a bucket and object key');
        }

        const { bucket, objectKey } = parsedPath;

        if (!objectKey || !this.minioService.listBuckets().includes(bucket)) {
            throw new Error('MinIO download requires a bucket and object key');
        }

        let stat;
        let nodeStream;

        try {
            stat = await this.minioService.statObject(bucket, objectKey);
            nodeStream = await this.minioService.getObjectStream(bucket, objectKey);
        } catch (error) {
            const code = (error as MinioLikeError).code;
            if (code === 'NotFound' || code === 'NoSuchKey') {
                throw Object.assign(new Error(`Object not found: ${bucket}/${objectKey}`), {
                    statusCode: 404
                });
            }

            throw error;
        }

        const filename = objectKey.slice(objectKey.lastIndexOf('/') + 1);
        const contentType = typeof stat.metaData['content-type'] === 'string'
            ? stat.metaData['content-type']
            : 'application/octet-stream';

        return {
            status: 200,
            headers: {
                'content-type': contentType,
                'content-length': `${stat.size}`,
                'content-disposition': buildAttachmentContentDisposition(filename)
            },
            stream: toWebReadableStream(nodeStream)
        };
    }
};
