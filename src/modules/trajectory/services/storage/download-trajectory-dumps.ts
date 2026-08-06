import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { createZstdDecompressionStream, isZstdObjectKey } from '@shared/infrastructure/storage/storage-codec';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import type { TrajectoryFrameSource } from '@shared/contracts/types/trajectory-frame-store';

export interface TrajectoryDumpReference {
    timestep: number;
    objectKey: string;
}

/**
 * Materializes a trajectory's stored dump objects onto local disk, decompressing the
 * zstd-encoded ones, so the parquet ingest worker can hand plain files to the native
 * parsers. Sequential on purpose: the caller's temp directory holds every frame at
 * once, so parallel downloads would multiply peak disk usage.
 */
export const downloadTrajectoryDumps = async (
    objectStore: ClusterObjectStore,
    ownerClusterId: string,
    dumps: readonly TrajectoryDumpReference[],
    tempDirectory: string
): Promise<TrajectoryFrameSource[]> => {
    const frames: TrajectoryFrameSource[] = [];

    for (const dump of dumps) {
        const response = await objectStore.getStream(
            ownerClusterId,
            ObjectBucketName.Dumps,
            dump.objectKey,
            { skipMetadata: true }
        );
        const dumpPath = path.join(tempDirectory, `timestep-${dump.timestep}.dump`);

        if (isZstdObjectKey(dump.objectKey)) {
            const decompressed = createZstdDecompressionStream(response.stream);
            await pipeline(decompressed.stream, createWriteStream(dumpPath));
            await decompressed.completion;
        } else {
            await pipeline(response.stream, createWriteStream(dumpPath));
        }

        frames.push({
            timestep: dump.timestep,
            dumpPath
        });
    }

    return frames;
};
