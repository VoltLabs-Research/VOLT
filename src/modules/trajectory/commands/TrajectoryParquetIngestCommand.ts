import { getTrajectoryFrameStore } from '@modules/trajectory/services/storage/ParquetTrajectoryFrameStore';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import Bottleneck from 'bottleneck';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import { logger } from '@shared/infrastructure/logger';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import type {
    TrajectoryFrameStore,
    TrajectoryFrameStoreIngestResult
} from '@shared/contracts/types/trajectory-frame-store';
import {
    downloadTrajectoryDumps,
    type TrajectoryDumpReference
} from '@modules/trajectory/services/storage/download-trajectory-dumps';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

interface TrajectoryParquetIngestCommandPayload {
    trajectoryId: string;
    ownerClusterId: string;
    frames: TrajectoryDumpReference[];
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
                const localFrames = await downloadTrajectoryDumps(
                    this.objectStore,
                    payload.ownerClusterId,
                    payload.frames,
                    tempDirectory
                );

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
