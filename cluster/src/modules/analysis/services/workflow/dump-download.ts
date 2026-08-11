import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { downloadDumpObject } from '@shared/infrastructure/storage/download-dump-object';

export const downloadCompressedDump = async (
    objectStore: ClusterObjectStore,
    objectKey: string,
    ownerClusterId: string,
    localDir: string
): Promise<string> => {
    const normalized = objectKey.startsWith('/') ? objectKey.slice(1) : objectKey;
    const fileName = basename(normalized);
    const localFileName = fileName.endsWith('.zst') ? fileName.slice(0, -4) : fileName;
    const localPath = join(localDir, `${localFileName}-${process.pid}-${randomUUID()}`);
    await mkdir(dirname(localPath), { recursive: true });

    await downloadDumpObject({
        objectStore,
        ownerClusterId,
        objectKey: normalized,
        localPath,
        decompress: true
    });
    return localPath;
};
