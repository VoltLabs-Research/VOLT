import { getTrajectoryFrameStore } from '@modules/trajectory/services/storage/ParquetTrajectoryFrameStore';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import Bottleneck from 'bottleneck';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import { logger } from '@shared/infrastructure/logger';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import type {
    TrajectoryFrameStore,
    TrajectoryFrameStoreIngestResult
} from '@shared/contracts/types/trajectory-frame-store';
import { createZstdDecompressionStream, isZstdObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { readPositiveIntegerEnv } from '@shared/domain/utilities/runtime-capacity';

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

const DEFAULT_TRAJECTORY_PARQUET_INGEST_CONCURRENCY = 1;
const TRAJECTORY_PARQUET_INGEST_CONCURRENCY = (
    readPositiveIntegerEnv('TRAJECTORY_PARQUET_INGEST_CONCURRENCY')
    ?? DEFAULT_TRAJECTORY_PARQUET_INGEST_CONCURRENCY
);

/**
 * Serializes parquet ingests: each one downloads every frame of a trajectory to
 * local disk before handing it to DuckDB, so overlapping runs multiply peak
 * memory and disk. Bottleneck re-checks capacity when a slot is released, which
 * a hand-rolled counter cannot do safely — incrementing after an `await` lets a
 * caller entering during the same microtask turn slip past a full gate.
 */
const parquetIngestLimiter = new Bottleneck({ maxConcurrent: TRAJECTORY_PARQUET_INGEST_CONCURRENCY });

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

        return parquetIngestLimiter.schedule(async () => {
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
                    localFrames.push({
                        timestep: frame.timestep,
                        dumpPath: localPath
                    });
                }

                logger.info(`@trajectory-parquet-ingest-command: downloaded ${localFrames.length} frames for trajectoryId=${payload.trajectoryId}`);

                return this.trajectoryFrameStore.ingest({
                    trajectoryId: payload.trajectoryId,
                    ownerClusterId: payload.ownerClusterId,
                    frames: localFrames,
                    customProperties: payload.customProperties
                });
            });
        });
    }
}

export const getTrajectoryParquetIngestCommand = commandGroupFactory(TrajectoryParquetIngestCommand, () => new TrajectoryParquetIngestCommand(getTrajectoryFrameStore(), getObjectStore()));
