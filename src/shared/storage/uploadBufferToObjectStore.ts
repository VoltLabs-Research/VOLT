import { createReadStream } from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

interface ObjectStoreClient {
    putObject(input: {
        bucket: string;
        objectKey: string;
        body: Buffer;
        metadata?: Record<string, string>;
    }): Promise<void>;

    putObjectStream(input: {
        bucket: string;
        objectKey: string;
        stream: Readable;
        size: number;
        metadata?: Record<string, string>;
    }): Promise<void>;
};

const STREAM_UPLOAD_THRESHOLD = 10 * 1024 * 1024;

export interface UploadBufferToObjectStoreInput {
    objectStore: ObjectStoreClient;
    bucket: string;
    objectKey: string;
    buffer: Buffer;
    contentType: string;
    tempDirectory: string;
    tempFilePrefix: string;
    tempFileSuffix?: string;
};

export const uploadBufferToObjectStore = async (input: UploadBufferToObjectStoreInput): Promise<void> => {
    if (input.buffer.length < STREAM_UPLOAD_THRESHOLD) {
        await input.objectStore.putObject({
            bucket: input.bucket,
            objectKey: input.objectKey,
            body: input.buffer,
            metadata: {
                'Content-Type': input.contentType
            }
        });
        return;
    }

    const tmpPath = path.join(
        input.tempDirectory,
        `${input.tempFilePrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}${input.tempFileSuffix ?? ''}`
    );

    try {
        await fsPromises.writeFile(tmpPath, input.buffer);
        await input.objectStore.putObjectStream({
            bucket: input.bucket,
            objectKey: input.objectKey,
            stream: createReadStream(tmpPath),
            size: input.buffer.length,
            metadata: {
                'Content-Type': input.contentType
            }
        });
    } finally {
        await fsPromises.unlink(tmpPath).catch(() => {});
    }
};
