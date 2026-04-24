import { createReadStream } from 'node:fs';
import { compressFileWithZstd } from '@/support/serialization/storage-codec';
import type { ScopedClusterObjectStore } from '@/core/storage/contracts/cluster-object-store';
import fsPromises from 'node:fs/promises';
import { tmpName } from 'tmp-promise';
import { safeRemovePath } from '@/support/fs/safe-remove-path';

export interface UploadBufferToObjectStoreInput {
    objectStore: ScopedClusterObjectStore;
    bucket: string;
    objectKey: string;
    buffer: Buffer;
    contentType: string;
    tempDirectory: string;
    tempFilePrefix: string;
    tempFileSuffix: string;
    contentEncoding?: string;
    compressionCodec?: 'zstd';
};

const STREAM_UPLOAD_THRESHOLD = 10 * 1024 * 1024;

export const uploadBufferToObjectStore = async (input: UploadBufferToObjectStoreInput): Promise<void> => {
    const metadata = {
        'Content-Type': input.contentType,
        ...(input.contentEncoding ? { 'Content-Encoding': input.contentEncoding } : {})
    };

    if (!input.compressionCodec && input.buffer.length < STREAM_UPLOAD_THRESHOLD) {
        await input.objectStore.putObject({
            bucket: input.bucket,
            objectKey: input.objectKey,
            body: input.buffer,
            metadata
        });
        return;
    }

    await fsPromises.mkdir(input.tempDirectory, { recursive: true });
    const tmpPath = await tmpName({
        tmpdir: input.tempDirectory,
        prefix: `${input.tempFilePrefix}-`,
        postfix: input.tempFileSuffix
    });
    const uploadPath = input.compressionCodec === 'zstd'
        ? `${tmpPath}.zst`
        : tmpPath;

    try {
        await fsPromises.writeFile(tmpPath, input.buffer);
        if (input.compressionCodec === 'zstd') {
            await compressFileWithZstd(tmpPath, uploadPath);
        }
        const uploadStats = await fsPromises.stat(uploadPath);
        await input.objectStore.putObjectStream({
            bucket: input.bucket,
            objectKey: input.objectKey,
            stream: createReadStream(uploadPath),
            size: uploadStats.size,
            metadata
        });
    } finally {
        if (uploadPath !== tmpPath) {
            await safeRemovePath(uploadPath);
        }
        await safeRemovePath(tmpPath);
    }
};
