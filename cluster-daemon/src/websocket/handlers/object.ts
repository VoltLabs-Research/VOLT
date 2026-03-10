import { uploadObject } from '../../core/runtimeActions';
import type { MinioService } from '../../infrastructure/minio/MinioService';
import type { RuntimeEventBroker } from '../../infrastructure/RuntimeEventBroker';
import type { ReverseChannelCommandHandler } from '../ReverseChannelSocketBridge';
import { readRecord, readString, toPayloadRecord } from './payloadValidation';
import { Readable } from 'node:stream';

interface ObjectHandlersDependencies {
    minioService: MinioService;
    eventBroker: RuntimeEventBroker;
}

export const createObjectHandlers = (deps: ObjectHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'object.upload',
        execute: async (payload) => {
            await uploadObject(payload as never, deps.minioService, deps.eventBroker);
            return { data: { uploaded: true } };
        }
    },
    {
        command: 'object.list',
        execute: async (payload) => {
            const body = readRecord(toPayloadRecord(payload), 'payload');
            const keys = await deps.minioService.listObjects(
                readString(body.bucket, 'bucket'),
                typeof body.prefix === 'string' ? body.prefix : ''
            );
            return { data: { keys } };
        }
    },
    {
        command: 'object.get',
        execute: async (payload) => {
            const body = readRecord(toPayloadRecord(payload), 'payload');
            const bucket = readString(body.bucket, 'bucket');
            const objectKey = readString(body.objectKey, 'objectKey');
            const stat = await deps.minioService.statObject(bucket, objectKey);
            const nodeStream = await deps.minioService.getObjectStream(bucket, objectKey);
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
