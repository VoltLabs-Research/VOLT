import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { type Job } from 'bullmq';
import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import type { QueueService } from '@/core/queues/application/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import type { LocalClusterObjectStoreGateway } from '@/core/storage/contracts/cluster-object-store';
import type { FrameProcessingQueueJobPayload } from '@/contracts';
import type { TrajectoryRasterQueue } from '@/modules/trajectory/application/raster/TrajectoryRasterQueue';
import type { TrajectoryFrameStore } from '@/modules/trajectory/application/storage/TrajectoryFrameStore';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import type { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import { createZstdDecompressionStream } from '@/support/serialization/storage-codec';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';
import { compressFileWithZstd } from '@/support/serialization/storage-codec';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { dumpParser, dataParser } from '@voltstack/lammps-io';
import spatialAssembler from '@voltstack/spatial-assembler';

const SESSION_KEY_PREFIX = 'trajectory-frame-session';
const SESSION_TTL_SECONDS = 86400;

@Service('trajectoryFrameProcessingWorker')
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
        super({ queueService, scopeLimitsRegistry: queueScopeLimitsRegistry });
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
        const maxAttempts = typeof bullJob.opts.attempts === 'number' ? bullJob.opts.attempts : 1;
        const isFinalAttempt = () => bullJob.attemptsMade + 1 >= maxAttempts;

        await withJobLifecycle(
            {
                reportStatus: this.buildStatusReporter(payload),
                shouldReportTerminal: () => isFinalAttempt(),
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

            // 1. Download raw dump from staging in local MinIO
            const stream = await this.minioService.getObjectStream(bucket, stagingObjectKey);
            await pipeline(stream, createWriteStream(localRawPath));

            await bullJob.updateProgress(10);

            // 2. Compress with zstd and store in final path
            await compressFileWithZstd(localRawPath, localCompressedPath);
            const compressedStat = await fs.stat(localCompressedPath);
            const finalObjectKey = `trajectory-${trajectoryId}/timestep-${timestep}.dump.zst`;

            await this.minioService.putObjectStream({
                bucket,
                objectKey: finalObjectKey,
                stream: createReadStream(localCompressedPath),
                size: compressedStat.size
            });

            await fs.unlink(localCompressedPath).catch(() => {});
            await bullJob.updateProgress(30);

            // 3. Generate GLB directly from raw dump
            await this.generateGlb(trajectoryId, timestep, ownerClusterId, localRawPath, tempDirectory);

            await bullJob.updateProgress(80);

            // 4. Delete staging object
            await this.minioService.removeObject(bucket, stagingObjectKey).catch((err) => {
                logger.debug(`@trajectory-frame-processing: staging cleanup failed ${stagingObjectKey}: ${String(err)}`);
            });

            // 5. Queue auto-preview rasterization
            try {
                await this.trajectoryRasterQueue.queueRasterizationJobs({
                    trajectoryId,
                    teamId: payload.teamId,
                    storageClusterId: ownerClusterId,
                    config: { autoPreview: true, timestep }
                });
            } catch (error) {
                logger.warn(
                    `@trajectory-frame-processing: raster queue failed trajectoryId=${trajectoryId} timestep=${timestep}: ${String(error)}`
                );
            }
        });

        // 6. Decrement session counter — if all frames done, trigger parquet ingest
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

            const frames: Array<{ timestep: number; objectKey: string }> = JSON.parse(framesDataRaw);

            await withNativeProcessingTempDir('trajectory-parquet-drain', async (tempDirectory) => {
                const localFrames: Array<{ timestep: number; dumpPath: string }> = [];

                for (const frame of frames) {
                    const response = await this.objectStore.getStream(
                        ownerClusterId,
                        ObjectBucketName.Dumps,
                        frame.objectKey,
                        { skipMetadata: true }
                    );
                    const localPath = path.join(tempDirectory, `timestep-${frame.timestep}.dump`);
                    const decompressed = createZstdDecompressionStream(response.stream);
                    await pipeline(decompressed.stream, createWriteStream(localPath));
                    await decompressed.completion;
                    localFrames.push({ timestep: frame.timestep, dumpPath: localPath });
                }

                await this.trajectoryFrameStore.ingest({
                    trajectoryId,
                    ownerClusterId,
                    frames: localFrames
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

        const modelObjectKey = `trajectory-${trajectoryId}/timestep-${timestep}.glb.zst`;
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
