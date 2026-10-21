import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createZstdDecompressionStream } from '@shared/storage/storage-codec';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { TEAM_CLUSTER_OBJECT_STORE_BUCKET } from '@voltstack/daemon-cluster-client';

interface DownloadDumpObjectInput {
    objectStore: ClusterObjectStore;
    ownerClusterId: string;
    objectKey: string;
    localPath: string;
    decompress: boolean;
}

export const downloadDumpObject = async (input: DownloadDumpObjectInput): Promise<void> => {
    const response = await input.objectStore.getStream(
        input.ownerClusterId,
        TEAM_CLUSTER_OBJECT_STORE_BUCKET.Dumps,
        input.objectKey,
        { skipMetadata: true }
    );

    if (!input.decompress) {
        await pipeline(response.stream, createWriteStream(input.localPath));
        return;
    }

    const decompressed = createZstdDecompressionStream(response.stream);
    await pipeline(decompressed.stream, createWriteStream(input.localPath));
    await decompressed.completion;
};
