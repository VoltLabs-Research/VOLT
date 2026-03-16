import { createObjectSyncService } from '@/modules/platform/services';
import { Readable } from 'node:stream';
import type { MinioService } from '@/modules/platform/services';
import type { ObjectUploadRequest, PluginSyncRequest, RuntimeEventBroker } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import {
    readObjectBucketName,
    readOptionalPayloadRecord,
    readOptionalString,
    readOptionalStringRecord,
    readPayloadRecord,
    readString,
    readTextEncoding
} from './payloadValidation';

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

export const createObjectHandlers = (deps: ObjectHandlersDependencies): ReverseChannelCommandHandler[] => {
    const objectSyncService = createObjectSyncService(deps.minioService, deps.eventBroker);

    return [
        {
            command: 'object.upload',
            execute: async (payload) => {
                await objectSyncService.uploadObject(readObjectUploadRequest(payload));
                return { data: { uploaded: true } };
            }
        },
        {
            command: 'object.list',
            execute: async (payload) => {
                const request = readObjectListRequest(payload);
                const keys = await deps.minioService.listObjects(request.bucket, request.prefix);
                return { data: { keys } };
            }
        },
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
