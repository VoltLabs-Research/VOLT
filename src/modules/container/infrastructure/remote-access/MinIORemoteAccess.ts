import { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import { RemoteExplorerContentType, RemoteExplorerEntryType, RemoteExplorerNodeType, RemoteExplorerTarget } from '@/contracts';
import type { ReverseChannelCommandResult } from '@/core/reverse-channel/contracts/command-handler';
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

        if (!parsedPath) {
            return {
                path,
                title: 'MinIO',
                type: RemoteExplorerNodeType.Object,
                contentType: RemoteExplorerContentType.Empty,
                textContent: null,
                mongoDocuments: []
            };
        }

        const { bucket, objectKey } = parsedPath;

        if (!objectKey || !this.minioService.listBuckets().includes(bucket)) {
            return {
                path,
                title: bucket,
                type: RemoteExplorerNodeType.Object,
                contentType: RemoteExplorerContentType.Empty,
                textContent: null,
                mongoDocuments: []
            };
        }

        const stream = await this.minioService.getObjectStream(bucket, objectKey);
        const chunks: Buffer[] = [];
        let totalBytes = 0;

        await new Promise<void>((resolve, reject) => {
            let isSettled = false;
            let isDestroying = false;

            const cleanup = (): void => {
                stream.removeListener('data', handleData);
                stream.removeListener('end', handleEnd);
                stream.removeListener('error', handleError);
                stream.removeListener('close', handleClose);
            };

            const handleClose = (): void => {
                if (!isDestroying) {
                    return;
                }

                cleanup();
            };

            const handleEnd = (): void => {
                if (isSettled) {
                    return;
                }

                isSettled = true;
                cleanup();
                resolve();
            };

            const handleError = (error: Error): void => {
                if (isDestroying) {
                    cleanup();
                    return;
                }

                if (isSettled) {
                    return;
                }

                isSettled = true;
                cleanup();
                reject(error);
            };

            const handleData = (chunk: Buffer): void => {
                if (totalBytes >= MAX_OBJECT_PREVIEW_BYTES) {
                    return;
                }

                const remainingBytes = MAX_OBJECT_PREVIEW_BYTES - totalBytes;
                const safeChunk = chunk.length > remainingBytes
                    ? chunk.subarray(0, remainingBytes)
                    : chunk;
                chunks.push(safeChunk);
                totalBytes += safeChunk.length;

                if (totalBytes < MAX_OBJECT_PREVIEW_BYTES) {
                    return;
                }

                isSettled = true;
                isDestroying = true;
                stream.removeListener('data', handleData);
                stream.removeListener('end', handleEnd);
                stream.once('close', handleClose);
                stream.pause();
                stream.destroy();
                resolve();
            };

            stream.on('data', handleData);
            stream.on('end', handleEnd);
            stream.on('error', handleError);
        });

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
