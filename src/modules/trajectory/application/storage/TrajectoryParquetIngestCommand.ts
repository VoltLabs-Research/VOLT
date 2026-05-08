import { Command, CommandGroup } from '@/core/commands/decorators';
import { logger } from '@/core/logger';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import type {
    TrajectoryFrameStore,
    TrajectoryFrameStoreIngestResult
} from '@/modules/trajectory/application/storage/TrajectoryFrameStore';
import { createZstdDecompressionStream, isZstdObjectKey } from '@/support/serialization/storage-codec';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

interface TrajectoryParquetIngestCommandFrameInput {
    timestep: number;
    objectKey: string;
}

interface TrajectoryParquetIngestCommandPayload {
    trajectoryId: string;
    ownerClusterId: string;
    frames: TrajectoryParquetIngestCommandFrameInput[];
    customProperties?: string[];
}

type TrajectoryParquetIngestCommandResponse = TrajectoryFrameStoreIngestResult;

@CommandGroup('trajectory.parquet')
export class TrajectoryParquetIngestCommand {
    public constructor(
        private readonly trajectoryFrameStore: TrajectoryFrameStore,
        private readonly objectStore: ClusterObjectStore
    ) {}

    @Command('ingest')
    public async ingest(payload: TrajectoryParquetIngestCommandPayload): Promise<TrajectoryParquetIngestCommandResponse> {
        if (!payload.ownerClusterId) {
            throw new Error('parquet ingest requires ownerClusterId');
        }
        if (payload.frames.length === 0) {
            throw new Error(`parquet ingest requires at least one frame (trajectoryId=${payload.trajectoryId})`);
        }

        return withNativeProcessingTempDir('trajectory-parquet-ingest-download', async (tempDirectory) => {
            const localFrames: { timestep: number; dumpPath: string }[] = [];

            for (const frame of payload.frames) {
                const response = await this.objectStore.getStream(
                    payload.ownerClusterId,
                    ObjectBucketName.Dumps,
                    frame.objectKey,
                    { skipMetadata: true }
                );
                const localPath = path.join(tempDirectory, `timestep-${frame.timestep}.dump`);
                if (isZstdObjectKey(frame.objectKey)) {
                    const decompressed = createZstdDecompressionStream(response.stream);
                    await pipeline(decompressed.stream, createWriteStream(localPath));
                    await decompressed.completion;
                } else {
                    await pipeline(response.stream, createWriteStream(localPath));
                }
                localFrames.push({ timestep: frame.timestep, dumpPath: localPath });
            }

            logger.info(`@trajectory-parquet-ingest-command: downloaded ${localFrames.length} frames for trajectoryId=${payload.trajectoryId}`);

            return this.trajectoryFrameStore.ingest({
                trajectoryId: payload.trajectoryId,
                ownerClusterId: payload.ownerClusterId,
                frames: localFrames,
                customProperties: payload.customProperties
            });
        });
    }
}
