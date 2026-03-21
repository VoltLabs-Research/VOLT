import { createChunkedObjectUploadService } from '@/modules/cloud-control/services';
import { createObjectSyncService, createObjectUploadLifecycleService } from '@/modules/platform/services';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts';
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
import { Readable } from 'node:stream';
import type { MinioService } from '@/modules/platform/services';
import type { ObjectDeleteRequest, ObjectUploadRequest, PluginSyncRequest, RuntimeEventBroker } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';

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

interface ObjectDeletePayloadRequest extends Omit<ObjectDeleteRequest, 'bucket'> {
    bucket: ObjectDeleteRequest['bucket'];
};

const toUint8ArrayChunk = (chunk: string | Buffer | Uint8Array): Uint8Array => {
    if (typeof chunk === 'string') {
        return Buffer.from(chunk);
    }

    if (chunk instanceof Uint8Array) {
        return chunk;
    }

    return new Uint8Array(chunk);
};

const toWebReadableStream = (stream: Readable): ReadableStream<Uint8Array> => {
    const iterator = stream[Symbol.asyncIterator]();

    return new ReadableStream<Uint8Array>({
        async pull(controller): Promise<void> {
            const result = await iterator.next();

            if (result.done) {
                controller.close();
                return;
            }

            controller.enqueue(toUint8ArrayChunk(result.value));
        },
        async cancel(reason): Promise<void> {
            if (typeof iterator.return === 'function') {
                await iterator.return();
            }

            const error = reason instanceof Error
                ? reason
                : new Error('Readable stream cancelled');
            stream.destroy(error);
        }
    });
};

const isMinioNotFoundError = (error: unknown): error is MinioLikeError => {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && (error.code === 'NotFound' || error.code === 'NoSuchKey');
};

const SAFE_TRANSFER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const readTransferId = (record: Record<string, unknown>, field: string): string => {
    const transferId = readString(record.transferId, field);

    if (!SAFE_TRANSFER_ID_PATTERN.test(transferId)) {
        throw new Error('transferId contains unsupported characters');
    }

    return transferId;
};

const readObjectUploadRequest = (payload: unknown): ObjectUploadRequest => {
    const record = readPayloadRecord(payload);
    if (typeof record.content !== 'string') {
        throw new Error('content is required');
    }

    const request: ObjectUploadRequest = {
        bucket: readObjectBucketName(record.bucket, 'bucket'),
        objectKey: readString(record.objectKey, 'objectKey'),
        content: record.content
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

const readPluginSyncRequest = (payload: unknown): PluginSyncRequest => {
    const record = readPayloadRecord(payload);

    return {
        pluginId: readString(record.pluginId, 'pluginId'),
        objectKey: readString(record.objectKey, 'objectKey')
    };
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

const readObjectDeleteRequest = (payload: unknown): ObjectDeletePayloadRequest => {
    const record = readOptionalPayloadRecord(payload);
    const objectKey = typeof record.objectKey === 'undefined'
        ? undefined
        : readString(record.objectKey, 'objectKey');
    const prefix = typeof record.prefix === 'undefined'
        ? undefined
        : readString(record.prefix, 'prefix');

    if ((!objectKey && !prefix) || (objectKey && prefix)) {
        throw new Error('Provide exactly one of objectKey or prefix');
    }

    return {
        bucket: readObjectBucketName(record.bucket, 'bucket'),
        objectKey,
        prefix
    };
};

export const createObjectHandlers = (deps: ObjectHandlersDependencies): ReverseChannelCommandHandler[] => {
    const objectSyncService = createObjectSyncService(deps.minioService, deps.eventBroker);
    const objectUploadLifecycleService = createObjectUploadLifecycleService(deps.minioService, deps.eventBroker);
    const chunkedObjectUploadService = createChunkedObjectUploadService({
        minioService: deps.minioService,
        objectUploadLifecycleService
    });

    return [
        // ── Legacy single-message upload ────────────────────────────────
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.object.upload,
            execute: async (payload) => {
                await objectSyncService.uploadObject(readObjectUploadRequest(payload));
                return { data: { uploaded: true } };
            }
        },

        // ── Chunked upload: init ────────────────────────────────────────
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.object.uploadInit,
            execute: async (payload) => {
                const record = readPayloadRecord(payload);
                await chunkedObjectUploadService.initializeTransfer({
                    transferId: readTransferId(record, 'transferId'),
                    bucket: readObjectBucketName(record.bucket, 'bucket'),
                    objectKey: readString(record.objectKey, 'objectKey'),
                    totalChunks: readNumber(record.totalChunks, 'totalChunks'),
                    metadata: readOptionalStringRecord(record.metadata, 'metadata')
                });

                return { data: { initialized: true } };
            }
        },

        // ── Chunked upload: chunk ───────────────────────────────────────
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.object.uploadChunk,
            execute: async (payload) => {
                const record = readPayloadRecord(payload);
                const result = await chunkedObjectUploadService.appendChunk({
                    transferId: readTransferId(record, 'transferId'),
                    index: readNumber(record.index, 'index'),
                    data: readString(record.data, 'data')
                });

                return { data: { received: true, index: result.index } };
            }
        },

        // ── Chunked upload: commit ──────────────────────────────────────
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.object.uploadCommit,
            execute: async (payload) => {
                const record = readPayloadRecord(payload);
                await chunkedObjectUploadService.commitTransfer({
                    transferId: readTransferId(record, 'transferId')
                });

                return { data: { uploaded: true } };
            }
        },

        // ── Chunked upload: abort ───────────────────────────────────────
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.object.uploadAbort,
            execute: async (payload) => {
                const record = readPayloadRecord(payload);
                const result = await chunkedObjectUploadService.abortTransfer({
                    transferId: readTransferId(record, 'transferId')
                });

                return {
                    data: {
                        aborted: result.aborted,
                        objectKey: result.objectKey,
                        transferId: result.transferId
                    }
                };
            }
        },

        // ── Object listing ──────────────────────────────────────────────
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.object.list,
            execute: async (payload) => {
                const request = readObjectListRequest(payload);
                const keys = await deps.minioService.listObjects(request.bucket, request.prefix);
                return { data: { keys } };
            }
        },

        // ── Object get ──────────────────────────────────────────────────
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.object.get,
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

                const stream = toWebReadableStream(nodeStream);
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
        },

        // ── Object delete ───────────────────────────────────────────────
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.object.delete,
            execute: async (payload) => {
                const request = readObjectDeleteRequest(payload);

                if (request.objectKey) {
                    await deps.minioService.removeObject(request.bucket, request.objectKey);
                    return {
                        data: {
                            deleted: true,
                            deletedCount: 1
                        }
                    };
                }

                const deletedCount = await deps.minioService.deleteByPrefix(request.bucket, request.prefix || '');

                return {
                    data: {
                        deleted: true,
                        deletedCount
                    }
                };
            }
        }
    ];
};
