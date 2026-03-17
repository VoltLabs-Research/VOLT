import { createObjectSyncService } from '@/modules/platform/services';
import { DAEMON_PATHS } from '@/core/paths';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { MinioService } from '@/modules/platform/services';
import type { ObjectUploadRequest, RuntimeEventBroker } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import {
    readObjectBucketName,
    readNumber,
    readOptionalPayloadRecord,
    readOptionalString,
    readOptionalStringRecord,
    readPayloadRecord,
    readString,
    readTextEncoding
} from './payloadValidation';
import { ObjectBucketName, OrchestrationAction } from '@/shared/contracts';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import { logger } from '@/core/logger';

interface MinioLikeError {
    code?: string;
};

interface ObjectHandlersDependencies {
    minioService: MinioService;
    eventBroker: RuntimeEventBroker;
};

interface ObjectListRequest {
    bucket: ObjectUploadRequest['bucket'];
    prefix: string;
};

interface ObjectGetRequest {
    bucket: ObjectUploadRequest['bucket'];
    objectKey: string;
};

/**
 * In-flight chunked transfer state.
 * Chunks are spooled to a temp file instead of accumulating in memory.
 */
interface ChunkedTransfer {
    bucket: ObjectBucketName;
    objectKey: string;
    totalChunks: number;
    metadata?: Record<string, string>;
    tempPath: string;
    nextChunkIndex: number;
    receivedCount: number;
    totalSize: number;
    createdAt: number;
    updatedAt: number;
};

/**
 * Stale transfers are cleaned up after 5 minutes.
 */
const TRANSFER_TTL_MS = 5 * 60 * 1000;

/**
 * How often to sweep for stale transfers.
 */
const TRANSFER_SWEEP_INTERVAL_MS = 60 * 1000;

const isMinioNotFoundError = (error: unknown): error is MinioLikeError => {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && (error.code === 'NotFound' || error.code === 'NoSuchKey');
};

const readObjectUploadRequest = (payload: unknown): ObjectUploadRequest => {
    const record = readPayloadRecord(payload);
    const request: ObjectUploadRequest = {
        bucket: readObjectBucketName(record.bucket, 'bucket'),
        objectKey: readString(record.objectKey, 'objectKey'),
        content: readString(record.content, 'content')
    };
    const encoding = readTextEncoding(record.encoding);
    const metadata = readOptionalStringRecord(record.metadata, 'metadata');

    if (encoding) {
        request.encoding = encoding;
    }

    if (metadata) {
        request.metadata = metadata;
    }

    return request;
};

const readObjectListRequest = (payload: unknown): ObjectListRequest => {
    const record = readOptionalPayloadRecord(payload);

    return {
        bucket: readObjectBucketName(record.bucket, 'bucket'),
        prefix: readOptionalString(record.prefix)
    };
};

const readObjectGetRequest = (payload: unknown): ObjectGetRequest => {
    const record = readOptionalPayloadRecord(payload);

    return {
        bucket: readObjectBucketName(record.bucket, 'bucket'),
        objectKey: readString(record.objectKey, 'objectKey')
    };
};

export const createObjectHandlers = (deps: ObjectHandlersDependencies): ReverseChannelCommandHandler[] => {
    const objectSyncService = createObjectSyncService(deps.minioService, deps.eventBroker);

    // ── Chunked transfer state ──────────────────────────────────────────
    const chunkedTransfers = new Map<string, ChunkedTransfer>();

    // Periodic sweep for abandoned transfers (also cleans up temp files)
    const sweepInterval = setInterval(() => {
        const now = Date.now();
        for (const [transferId, transfer] of chunkedTransfers) {
            if (now - transfer.updatedAt > TRANSFER_TTL_MS) {
                chunkedTransfers.delete(transferId);
                fsPromises.unlink(transfer.tempPath).catch(() => {});
                logger.warn(
                    { transferId, objectKey: transfer.objectKey },
                    'Chunked transfer expired — cleaned up stale state and temp file'
                );
            }
        }
    }, TRANSFER_SWEEP_INTERVAL_MS);
    sweepInterval.unref();

    return [
        // ── Legacy single-message upload ────────────────────────────────
        {
            command: 'object.upload',
            execute: async (payload) => {
                await objectSyncService.uploadObject(readObjectUploadRequest(payload));
                return { data: { uploaded: true } };
            }
        },

        // ── Chunked upload: init ────────────────────────────────────────
        {
            command: 'object.upload.init',
            execute: async (payload) => {
                const record = readPayloadRecord(payload);
                const transferId = readString(record.transferId, 'transferId');
                const bucket = readObjectBucketName(record.bucket, 'bucket');
                const objectKey = readString(record.objectKey, 'objectKey');
                const totalChunks = readNumber(record.totalChunks, 'totalChunks');
                const metadata = readOptionalStringRecord(record.metadata, 'metadata');

                if (totalChunks <= 0 || totalChunks > 100_000) {
                    throw new Error('totalChunks must be between 1 and 100000');
                }

                if (chunkedTransfers.has(transferId)) {
                    throw new Error(`Transfer ${transferId} already exists`);
                }

                const tempPath = path.join(DAEMON_PATHS.analysisOutput, `chunked-upload-${transferId}`);
                // Create an empty file to append chunks into
                await fsPromises.writeFile(tempPath, Buffer.alloc(0));

                chunkedTransfers.set(transferId, {
                    bucket,
                    objectKey,
                    totalChunks,
                    metadata,
                    tempPath,
                    nextChunkIndex: 0,
                    receivedCount: 0,
                    totalSize: 0,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });

                logger.info(
                    { transferId, objectKey, totalChunks, tempPath },
                    'Chunked upload initialized (disk-spooled)'
                );

                return { data: { initialized: true } };
            }
        },

        // ── Chunked upload: chunk ───────────────────────────────────────
        {
            command: 'object.upload.chunk',
            execute: async (payload) => {
                const record = readPayloadRecord(payload);
                const transferId = readString(record.transferId, 'transferId');
                const index = readNumber(record.index, 'index');
                const data = readString(record.data, 'data');

                const transfer = chunkedTransfers.get(transferId);
                if (!transfer) {
                    throw new Error(`Unknown transfer: ${transferId}`);
                }

                if (index < 0 || index >= transfer.totalChunks) {
                    throw new Error(`Chunk index ${index} out of range [0, ${transfer.totalChunks})`);
                }

                if (index !== transfer.nextChunkIndex) {
                    throw new Error(
                        `Chunk index ${index} out of order for transfer ${transferId}; expected ${transfer.nextChunkIndex}`
                    );
                }

                const chunkBuffer = Buffer.from(data, 'base64');
                await fsPromises.appendFile(transfer.tempPath, chunkBuffer);
                transfer.nextChunkIndex += 1;
                transfer.receivedCount += 1;
                transfer.totalSize += chunkBuffer.length;
                transfer.updatedAt = Date.now();

                return { data: { received: true, index } };
            }
        },

        // ── Chunked upload: commit ──────────────────────────────────────
        {
            command: 'object.upload.commit',
            execute: async (payload) => {
                const record = readPayloadRecord(payload);
                const transferId = readString(record.transferId, 'transferId');

                const transfer = chunkedTransfers.get(transferId);
                if (!transfer) {
                    throw new Error(`Unknown transfer: ${transferId}`);
                }

                if (transfer.receivedCount !== transfer.totalChunks) {
                    throw new Error(
                        `Transfer ${transferId} incomplete: received ${transfer.receivedCount}/${transfer.totalChunks} chunks`
                    );
                }
                transfer.updatedAt = Date.now();

                try {
                    // Stream the spooled temp file directly to MinIO — no in-memory concat
                    await deps.minioService.putObjectStream({
                        bucket: transfer.bucket,
                        objectKey: transfer.objectKey,
                        stream: createReadStream(transfer.tempPath),
                        size: transfer.totalSize,
                        metadata: transfer.metadata
                    });
                } finally {
                    chunkedTransfers.delete(transferId);
                    await fsPromises.unlink(transfer.tempPath).catch(() => {});
                }

                deps.eventBroker.emitProgress({
                    action: OrchestrationAction.ObjectUpload,
                    stage: ProgressStageType.Completed,
                    payload: {
                        bucket: transfer.bucket,
                        objectKey: transfer.objectKey
                    },
                    timestamp: new Date().toISOString()
                });

                logger.info(
                    { transferId, objectKey: transfer.objectKey, totalSize: transfer.totalSize },
                    'Chunked upload committed to MinIO (streamed from disk)'
                );

                return { data: { uploaded: true } };
            }
        },

        // ── Object listing ──────────────────────────────────────────────
        {
            command: 'object.list',
            execute: async (payload) => {
                const request = readObjectListRequest(payload);
                const keys = await deps.minioService.listObjects(request.bucket, request.prefix);
                return { data: { keys } };
            }
        },

        // ── Object get ──────────────────────────────────────────────────
        {
            command: 'object.get',
            execute: async (payload) => {
                const request = readObjectGetRequest(payload);
                let stat;
                let nodeStream;

                try {
                    stat = await deps.minioService.statObject(request.bucket, request.objectKey);
                    nodeStream = await deps.minioService.getObjectStream(request.bucket, request.objectKey);
                } catch (error) {
                    if (isMinioNotFoundError(error)) {
                        return {
                            status: 404,
                            data: {
                                message: `Object not found: ${request.bucket}/${request.objectKey}`
                            }
                        };
                    }

                    throw error;
                }

                const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
                const headers: Record<string, string> = {
                    'content-length': String(stat.size)
                };
                if (typeof stat.metaData['content-type'] === 'string') {
                    headers['content-type'] = stat.metaData['content-type'];
                }

                return {
                    status: 200,
                    headers,
                    stream
                };
            }
        }
    ];
};
