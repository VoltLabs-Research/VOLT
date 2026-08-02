import { singleton } from '@shared/application/utilities/singleton';
import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { getQueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { getMinioService } from '@shared/infrastructure/storage/MinioService';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { getTrajectoryRasterQueue } from '@modules/trajectory/services/raster/TrajectoryRasterQueue';
import { getTrajectoryFrameStore } from '@modules/trajectory/services/storage/ParquetTrajectoryFrameStore';
import { getRedisConnection } from '@shared/infrastructure/redis/RedisConnection';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { type Job } from 'bullmq';
import { logger } from '@shared/infrastructure/logger';
import { BaseWorker } from '@shared/infrastructure/queues/BaseWorker';
import { createLifecycleStatusReporter } from '@shared/infrastructure/queues/create-status-reporter';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { isFinalAttempt, withJobLifecycle } from '@shared/infrastructure/queues/with-job-lifecycle';
import { TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME } from '@core/constants/queue-names';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import type { LocalClusterObjectStoreGateway } from '@shared/contracts/types/cluster-object-store';
import type { FrameProcessingQueueJobPayload } from '@shared/contracts';
import type { TrajectoryRasterQueue } from '@modules/trajectory/services/raster/TrajectoryRasterQueue';
import type { TrajectoryFrameStore } from '@shared/contracts/types/trajectory-frame-store';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import type { RedisConnection } from '@shared/infrastructure/redis/RedisConnection';
import {
    downloadTrajectoryDumps,
    type TrajectoryDumpReference
} from '@modules/trajectory/services/storage/download-trajectory-dumps';
import type { DaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { compressFileWithZstd, toTrajectoryFrameDumpObjectKey, toTrajectoryFrameModelObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import { dumpParser, dataParser } from '@voltstack/lammps-io';
import spatialAssembler from '@voltstack/spatial-assembler';

const SESSION_KEY_PREFIX = 'trajectory-frame-session';

export class TrajectoryFrameProcessingWorker extends BaseWorker<FrameProcessingQueueJobPayload> {
    protected readonly queueName = TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME;
    protected readonly scopeKey: QueueScopeKey = 'trajectoryGlbConversion';
    private readonly buildStatusReporter: ReturnType<typeof createLifecycleStatusReporter<FrameProcessingQueueJobPayload>>;

    constructor(
        queueService: QueueService,
        queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly minioService: LocalClusterObjectStoreGateway,
        private readonly objectStore: ClusterObjectStore,
        private readonly trajectoryRasterQueue: TrajectoryRasterQueue,
        private readonly trajectoryFrameStore: TrajectoryFrameStore,
        private readonly redisConnection: RedisConnection,
        daemonJobReporter: DaemonJobReporter
    ) {
        super({
            queueService,
            scopeLimitsRegistry: queueScopeLimitsRegistry
        });
        this.buildStatusReporter = createLifecycleStatusReporter<FrameProcessingQueueJobPayload>(
            {
                started: daemonJobReporter.reportGlbStarted,
                completed: daemonJobReporter.reportGlbCompleted,
                failed: daemonJobReporter.reportGlbFailed
            },
            'trajectory frame processing'
        );
    }

    protected async process(payload: FrameProcessingQueueJobPayload, bullJob: Job<FrameProcessingQueueJobPayload>): Promise<void> {
        await withJobLifecycle(
            {
                reportStatus: this.buildStatusReporter(payload),
                shouldReportTerminal: () => isFinalAttempt(bullJob),
                progress: (value) => bullJob.updateProgress(value)
            },
            () => this.processFrame(payload, bullJob)
        );
    }

    private async processFrame(payload: FrameProcessingQueueJobPayload, bullJob: Job<FrameProcessingQueueJobPayload>): Promise<void> {
        const { trajectoryId, timestep, stagingObjectKey, ownerClusterId } = payload;
        const bucket = ObjectBucketName.Dumps;

        await withNativeProcessingTempDir('trajectory-frame-processing', async (tempDirectory) => {
            const localRawPath = path.join(tempDirectory, `timestep-${timestep}.dump`);
            const localCompressedPath = `${localRawPath}.zst`;

            const stream = await this.minioService.getObjectStream(bucket, stagingObjectKey);
            await pipeline(stream, createWriteStream(localRawPath));

            await bullJob.updateProgress(10);

            await compressFileWithZstd(localRawPath, localCompressedPath);
            const compressedStat = await fs.stat(localCompressedPath);
            const finalObjectKey = toTrajectoryFrameDumpObjectKey(trajectoryId, timestep);

            await this.minioService.putObjectStream({
                bucket,
                objectKey: finalObjectKey,
                stream: createReadStream(localCompressedPath),
                size: compressedStat.size
            });

            await fs.unlink(localCompressedPath).catch(() => {});
            await bullJob.updateProgress(30);

            await this.generateGlb(trajectoryId, timestep, ownerClusterId, localRawPath, tempDirectory);

            await bullJob.updateProgress(80);

            await this.minioService.removeObject(bucket, stagingObjectKey).catch((err) => {
                logger.debug(`@trajectory-frame-processing: staging cleanup failed ${stagingObjectKey}: ${String(err)}`);
            });

            try {
                await this.trajectoryRasterQueue.queueRasterizationJobs({
                    trajectoryId,
                    teamId: payload.teamId,
                    storageClusterId: ownerClusterId,
                    config: {
                        autoPreview: true,
                        timestep
                    }
                });
            } catch (error) {
                logger.warn(
                    `@trajectory-frame-processing: raster queue failed trajectoryId=${trajectoryId} timestep=${timestep}: ${String(error)}`
                );
            }
        });

        await this.decrementAndCheckDrain(payload);
    }

    private async decrementAndCheckDrain(payload: FrameProcessingQueueJobPayload): Promise<void> {
        const { trajectoryId, ownerClusterId } = payload;
        const sessionKey = `${SESSION_KEY_PREFIX}:${trajectoryId}:remaining`;

        const remaining = await this.redisConnection.decrementKey(sessionKey);
        if (remaining > 0) return;

        await this.redisConnection.deleteKey(sessionKey);
        logger.info(`@trajectory-frame-processing: all frames done, starting parquet ingest trajectoryId=${trajectoryId}`);

        try {
            const framesDataRaw = await this.redisConnection.getValue(`${SESSION_KEY_PREFIX}:${trajectoryId}:frames`);
            await this.redisConnection.deleteKey(`${SESSION_KEY_PREFIX}:${trajectoryId}:frames`);

            if (!framesDataRaw) {
                logger.warn(`@trajectory-frame-processing: no frame data found for parquet ingest trajectoryId=${trajectoryId}`);
                return;
            }

            const frames: TrajectoryDumpReference[] = JSON.parse(framesDataRaw);

            await withNativeProcessingTempDir('trajectory-parquet-drain', async (tempDirectory) => {
                await this.trajectoryFrameStore.ingest({
                    trajectoryId,
                    ownerClusterId,
                    frames: await downloadTrajectoryDumps(this.objectStore, ownerClusterId, frames, tempDirectory)
                });
            });

            logger.info(`@trajectory-frame-processing: parquet ingest complete trajectoryId=${trajectoryId} frameCount=${frames.length}`);
        } catch (error) {
            logger.error(`@trajectory-frame-processing: parquet ingest failed trajectoryId=${trajectoryId}: ${String(error)}`);
        }
    }

    private async generateGlb(
        trajectoryId: string,
        timestep: number,
        ownerClusterId: string,
        localRawPath: string,
        tempDirectory: string
    ): Promise<void> {
        const parsed = dumpParser.parseDump(localRawPath, { includeIds: false }) ??
            dataParser.parseData(localRawPath, { includeIds: false });

        if (!parsed) {
            throw new Error(`Failed to parse dump file for GLB generation: trajectoryId=${trajectoryId} timestep=${timestep}`);
        }

        const glbPath = path.join(tempDirectory, `${timestep}.glb`);
        const glbCompressedPath = `${glbPath}.zst`;

        const exported = spatialAssembler.generateGLBToFile(
            parsed.positions,
            parsed.types,
            parsed.min,
            parsed.max,
            glbPath
        );

        if (!exported) {
            throw new Error(`GLB export failed for trajectoryId=${trajectoryId} timestep=${timestep}`);
        }

        await compressFileWithZstd(glbPath, glbCompressedPath);
        const glbStats = await fs.stat(glbCompressedPath);

        const modelObjectKey = toTrajectoryFrameModelObjectKey(trajectoryId, timestep);
        await this.objectStore.putObjectStream({
            ownerClusterId,
            bucket: ObjectBucketName.Models,
            objectKey: modelObjectKey,
            stream: createReadStream(glbCompressedPath),
            size: glbStats.size,
            metadata: {
                'Content-Type': 'model/gltf-binary',
                'Content-Encoding': 'zstd'
            }
        });
    }
}

export const getTrajectoryFrameProcessingWorker = singleton((): TrajectoryFrameProcessingWorker => new TrajectoryFrameProcessingWorker(getQueueService(), getQueueScopeLimitsRegistry(), getMinioService(), getObjectStore(), getTrajectoryRasterQueue(), getTrajectoryFrameStore(), getRedisConnection(), getDaemonJobReporter()));
