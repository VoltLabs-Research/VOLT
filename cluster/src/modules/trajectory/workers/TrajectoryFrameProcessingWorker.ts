import { singleton } from '@shared/application/utilities/singleton';
import { defineDaemonWorker } from '@shared/infrastructure/queues/worker-registry';
import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { getQueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { getFilesystemObjectStore } from '@shared/infrastructure/storage/FilesystemObjectStore';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { getTrajectoryRasterQueue } from '@modules/trajectory/services/raster/TrajectoryRasterQueue';
import { getTrajectoryFrameStore } from '@modules/trajectory/services/storage/ParquetTrajectoryFrameStore';
import { getDaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import { toParquetDrainClaimKey } from '@shared/infrastructure/persistence/daemon-state-keys';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { QueueJobHandle } from '@shared/infrastructure/queues/queue-job-handle';
import { logger } from '@shared/infrastructure/logger';
import { BaseWorker } from '@shared/infrastructure/queues/BaseWorker';
import { createLifecycleStatusReporter } from '@shared/infrastructure/queues/create-status-reporter';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { isFinalAttempt, withJobLifecycle } from '@shared/infrastructure/queues/with-job-lifecycle';
import { listLiveJobsByKeyPrefix } from '@shared/infrastructure/queues/queue-job-store';
import {
    TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME,
    toTrajectoryFrameJobKey,
    toTrajectoryFrameJobKeyPrefix
} from '@core/constants/queue-names';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import type { LocalClusterObjectStoreGateway, ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import type { FrameProcessingQueueJobPayload } from '@shared/contracts/types/queue-trajectory';
import type { TrajectoryRasterQueue } from '@modules/trajectory/services/raster/TrajectoryRasterQueue';
import type { TrajectoryFrameStore } from '@shared/contracts/types/trajectory-frame-store';

import type { DaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import {
    downloadTrajectoryDumps,
    type TrajectoryDumpReference
} from '@modules/trajectory/services/storage/download-trajectory-dumps';
import type { DaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import {
    compressFileWithZstd,
    parseTrajectoryFrameDumpTimestep,
    toTrajectoryFrameDumpObjectKey,
    toTrajectoryFrameModelObjectKey,
    toTrajectoryObjectKeyPrefix
} from '@shared/infrastructure/storage/storage-codec';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import { readFrame } from '@voltstack/lammps-io';
import spatialAssembler from '@voltstack/spatial-assembler';

const DRAIN_CLAIM_TTL_SECONDS = 30 * 60;

const DUMP_LIST_PAGE_SIZE = 1_000;

export class TrajectoryFrameProcessingWorker extends BaseWorker<FrameProcessingQueueJobPayload> {
    protected readonly queueName = TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME;
    protected readonly scopeKey: QueueScopeKey = 'trajectoryGlbConversion';
    private readonly buildStatusReporter: ReturnType<typeof createLifecycleStatusReporter<FrameProcessingQueueJobPayload>>;

    constructor(
        queueService: QueueService,
        queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly localObjectStore: LocalClusterObjectStoreGateway,
        private readonly objectStore: ClusterObjectStore,
        private readonly trajectoryRasterQueue: TrajectoryRasterQueue,
        private readonly trajectoryFrameStore: TrajectoryFrameStore,
        private readonly stateStore: DaemonStateStore,
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

    protected async process(payload: FrameProcessingQueueJobPayload, job: QueueJobHandle<FrameProcessingQueueJobPayload>): Promise<void> {
        try {
            await withJobLifecycle(
                {
                    reportStatus: this.buildStatusReporter(payload),
                    shouldReportTerminal: () => isFinalAttempt(job)
                },
                () => this.processFrame(payload, job)
            );
        } catch (error) {
            if (isFinalAttempt(job)) {
                await this.drainWhenFramesSettled(payload, { selfAbandoned: true }).catch((drainError: unknown) => {
                    logger.error(
                        `@trajectory-frame-processing: drain check after terminal failure failed trajectoryId=${payload.trajectoryId}: ${String(drainError)}`
                    );
                });
            }

            throw error;
        }
    }

    private async processFrame(payload: FrameProcessingQueueJobPayload, job: QueueJobHandle<FrameProcessingQueueJobPayload>): Promise<void> {
        const { trajectoryId, timestep, stagingObjectKey, ownerClusterId } = payload;
        const bucket = ObjectBucketName.Dumps;

        await withNativeProcessingTempDir('trajectory-frame-processing', async (tempDirectory) => {
            const localRawPath = path.join(tempDirectory, `timestep-${timestep}.dump`);
            const localCompressedPath = `${localRawPath}.zst`;

            const stream = await this.localObjectStore.getObjectStream(bucket, stagingObjectKey);
            await pipeline(stream, createWriteStream(localRawPath));


            await compressFileWithZstd(localRawPath, localCompressedPath);
            const compressedStat = await fs.stat(localCompressedPath);
            const finalObjectKey = toTrajectoryFrameDumpObjectKey(trajectoryId, timestep);

            await this.localObjectStore.putObjectStream({
                bucket,
                objectKey: finalObjectKey,
                stream: createReadStream(localCompressedPath),
                size: compressedStat.size
            });

            await fs.unlink(localCompressedPath).catch(() => {});

            await this.generateGlb(trajectoryId, timestep, ownerClusterId, localRawPath, tempDirectory);


            await this.localObjectStore.removeObject(bucket, stagingObjectKey).catch((err) => {
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

        await this.drainWhenFramesSettled(payload);
    }

    private async drainWhenFramesSettled(
        payload: FrameProcessingQueueJobPayload,
        { selfAbandoned = false }: { selfAbandoned?: boolean } = {}
    ): Promise<void> {
        const { trajectoryId, ownerClusterId } = payload;
        const jobKeyPrefix = toTrajectoryFrameJobKeyPrefix(trajectoryId);
        const selfJobKey = toTrajectoryFrameJobKey(trajectoryId, payload.timestep);

        const liveJobs = await listLiveJobsByKeyPrefix(TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME, jobKeyPrefix);
        const liveSiblings = liveJobs.filter((job) => job.jobKey !== selfJobKey);

        if (liveSiblings.some((job) => job.state === 'waiting')) return;

        for (const job of liveSiblings) {
            const timestep = Number(job.jobKey.slice(jobKeyPrefix.length));
            if (!await this.hasFrameDump(trajectoryId, timestep)) return;
        }

        if (!selfAbandoned && !await this.hasFrameDump(trajectoryId, payload.timestep)) return;

        const dumps = await this.listFrameDumps(trajectoryId);
        if (dumps.length === 0) {
            logger.warn(`@trajectory-frame-processing: no frame dumps to ingest trajectoryId=${trajectoryId}`);
            return;
        }

        const claimed = await this.stateStore.setKeyIfAbsent(
            toParquetDrainClaimKey(trajectoryId),
            new Date().toISOString(),
            DRAIN_CLAIM_TTL_SECONDS
        );
        if (!claimed) return;

        logger.info(
            `@trajectory-frame-processing: all frames settled, starting parquet ingest trajectoryId=${trajectoryId} frameCount=${dumps.length}`
        );

        try {
            await withNativeProcessingTempDir('trajectory-parquet-drain', async (tempDirectory) => {
                await this.trajectoryFrameStore.ingest({
                    trajectoryId,
                    ownerClusterId,
                    frames: await downloadTrajectoryDumps(this.objectStore, ownerClusterId, dumps, tempDirectory)
                });
            });

            logger.info(`@trajectory-frame-processing: parquet ingest complete trajectoryId=${trajectoryId} frameCount=${dumps.length}`);
        } catch (error) {
            await this.stateStore.deleteKey(toParquetDrainClaimKey(trajectoryId)).catch(() => {});
            logger.error(`@trajectory-frame-processing: parquet ingest failed trajectoryId=${trajectoryId}: ${String(error)}`);
        }
    }

    private async hasFrameDump(trajectoryId: string, timestep: number): Promise<boolean> {
        try {
            await this.localObjectStore.statObject(
                ObjectBucketName.Dumps,
                toTrajectoryFrameDumpObjectKey(trajectoryId, timestep)
            );
            return true;
        } catch {
            return false;
        }
    }

    private async listFrameDumps(trajectoryId: string): Promise<TrajectoryDumpReference[]> {
        const prefix = toTrajectoryObjectKeyPrefix(trajectoryId);
        const dumps: TrajectoryDumpReference[] = [];
        let cursor: string | undefined;

        do {
            const page = await this.localObjectStore.listObjectsPage({
                bucket: ObjectBucketName.Dumps,
                prefix,
                limit: DUMP_LIST_PAGE_SIZE,
                cursor
            });

            for (const objectKey of page.keys) {
                const timestep = parseTrajectoryFrameDumpTimestep(objectKey);
                if (timestep !== null) {
                    dumps.push({
                        timestep,
                        objectKey
                    });
                }
            }

            cursor = page.nextCursor;
        } while (cursor);

        return dumps.sort((left, right) => left.timestep - right.timestep);
    }

    private async generateGlb(
        trajectoryId: string,
        timestep: number,
        ownerClusterId: string,
        localRawPath: string,
        tempDirectory: string
    ): Promise<void> {
        const parsed = readFrame(localRawPath);

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

export const trajectoryFrameProcessingWorker = defineDaemonWorker({
    name: 'trajectory-frame-processing',
    scope: 'always',
    concurrencyKey: 'glbPreprocessing',
    tracksConcurrencyWhileRunning: false
}, singleton((): TrajectoryFrameProcessingWorker => new TrajectoryFrameProcessingWorker(getQueueService(), getQueueScopeLimitsRegistry(), getFilesystemObjectStore(), getObjectStore(), getTrajectoryRasterQueue(), getTrajectoryFrameStore(), getDaemonStateStore(), getDaemonJobReporter())));
