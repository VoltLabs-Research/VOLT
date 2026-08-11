import path from 'node:path';
import { isZstdObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { downloadDumpObject } from '@shared/infrastructure/storage/download-dump-object';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
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
        const dumpPath = path.join(tempDirectory, `timestep-${dump.timestep}.dump`);
        await downloadDumpObject({
            objectStore,
            ownerClusterId,
            objectKey: dump.objectKey,
            localPath: dumpPath,
            decompress: isZstdObjectKey(dump.objectKey)
        });

        frames.push({
            timestep: dump.timestep,
            dumpPath
        });
    }

    return frames;
};
