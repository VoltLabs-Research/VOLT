import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { createZstdDecompressionStream } from '@/support/serialization/storage-codec';

export const downloadCompressedDump = async (
    objectStore: ClusterObjectStore,
    objectKey: string,
    ownerClusterId: string,
    localDir: string
): Promise<string> => {
    const normalized = objectKey.startsWith('/') ? objectKey.slice(1) : objectKey;
    const fileName = basename(normalized);
    const localFileName = fileName.endsWith('.zst') ? fileName.slice(0, -4) : fileName;
    const localPath = join(localDir, `${localFileName}-${Date.now()}`);
    await mkdir(dirname(localPath), { recursive: true });

    const response = await objectStore.getStream(ownerClusterId, ObjectBucketName.Dumps, normalized, { skipMetadata: true });
    const decompressed = createZstdDecompressionStream(response.stream);
    await pipeline(decompressed.stream, createWriteStream(localPath));
    await decompressed.completion;
    return localPath;
};
