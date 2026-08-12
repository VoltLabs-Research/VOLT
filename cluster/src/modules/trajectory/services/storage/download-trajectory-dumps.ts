import path from 'node:path';
import { isZstdObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { downloadDumpObject } from '@shared/infrastructure/storage/download-dump-object';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import type { TrajectoryFrameSource } from '@shared/contracts/types/trajectory-frame-store';

export interface TrajectoryDumpReference {
    timestep: number;
    objectKey: string;
}

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
