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
import { dumpParser, dataParser, type NativeParseResult } from '@voltstack/lammps-io';
import spatialAssembler from '@voltstack/spatial-assembler';
import { errorMessage } from '@shared/application/utilities/error-message';

/**
 * Long enough that a slow parquet build is never raced by a straggler frame, short
 * enough that a daemon killed mid-build does not block a retry for the rest of the
 * day. Only ever released early on failure.
 */
const DRAIN_CLAIM_TTL_SECONDS = 30 * 60;

const DUMP_LIST_PAGE_SIZE = 1_000;

/**
 * Reads a staged frame as either a LAMMPS dump or a LAMMPS data file.
 *
 * `parseDump` *throws* on a non-dump file rather than returning null, so the `??`
 * chain this replaces never reached the data-file branch — uploading a LAMMPS data
 * file failed the whole GLB job. Mirrors the fallback in parquet-ingest-worker.cjs.
 */
const parseFrameForGlb = (filePath: string): NativeParseResult => {
    let dumpFailure: unknown = new Error('parser returned no frame');

    try {
        const parsed = dumpParser.parseDump(filePath, { includeIds: false });
        if (parsed) return parsed;
    } catch (error) {
        dumpFailure = error;
    }

    let dataFailure: unknown = new Error('parser returned no frame');

    try {
        const parsed = dataParser.parseData(filePath, { includeIds: false });
        if (parsed) return parsed;
    } catch (error) {
        dataFailure = error;
    }

    throw new Error(
        `Unsupported trajectory format: ${filePath} ` +
        `(dump: ${errorMessage(dumpFailure)}; data: ${errorMessage(dataFailure)})`
    );
};

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
            // The frame that gives up can be the last one of the trajectory, and no
            // sibling is left to notice the group is finished. So it looks before it
            // goes, declaring itself abandoned: the remaining frames get their parquet
            // instead of the trajectory sitting in `Processing` forever.
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

    /**
     * Builds the trajectory's parquet once every frame has landed its dump.
     *
     * Both halves of the question are *derived* rather than tracked. Which frames
     * exist is whatever dumps are in storage; which frames are still coming is
     * whatever the queue still lists as live. The counter this replaces could not
     * survive a frame that failed permanently — it never reached zero, and the
     * trajectory stayed in `Processing` behind a key that expired 24 hours later.
     */
    private async drainWhenFramesSettled(
        payload: FrameProcessingQueueJobPayload,
        { selfAbandoned = false }: { selfAbandoned?: boolean } = {}
    ): Promise<void> {
        const { trajectoryId, ownerClusterId } = payload;
        const jobKeyPrefix = toTrajectoryFrameJobKeyPrefix(trajectoryId);
        const selfJobKey = toTrajectoryFrameJobKey(trajectoryId, payload.timestep);

        const liveJobs = await listLiveJobsByKeyPrefix(TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME, jobKeyPrefix);
        const liveSiblings = liveJobs.filter((job) => job.jobKey !== selfJobKey);

        // A sibling that has not started cannot have written a dump, so for every frame
        // but the last few this single check ends the method.
        if (liveSiblings.some((job) => job.state === 'waiting')) return;

        // The rest are mid-flight or waiting on a retry, and one of those only holds the
        // group up while it still owes a dump: a sibling that already wrote its dump has
        // nothing left to contribute to the parquet even though its job stays `active`
        // finishing GLB and raster work. That distinction is the whole point, because
        // the queue marks a job complete only after its handler returns, so frames
        // finishing together all see each other as live. There are at most `concurrency`
        // of them, so probing individually stays cheap.
        for (const job of liveSiblings) {
            const timestep = Number(job.jobKey.slice(jobKeyPrefix.length));
            if (!await this.hasFrameDump(trajectoryId, timestep)) return;
        }

        // This frame is the last one, or one of a batch that all finished together. If
        // it is here because it gave up, it owes a dump it will never write, so only a
        // successful frame can conclude the group is complete.
        if (!selfAbandoned && !await this.hasFrameDump(trajectoryId, payload.timestep)) return;

        const dumps = await this.listFrameDumps(trajectoryId);
        if (dumps.length === 0) {
            logger.warn(`@trajectory-frame-processing: no frame dumps to ingest trajectoryId=${trajectoryId}`);
            return;
        }

        // Exactly one of the frames standing here gets to build the parquet.
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
            // Released only on failure: a retrying frame job should be able to try the
            // ingest again, but a straggler arriving after a successful build must not
            // rebuild it. On success the claim simply expires.
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

    /**
     * The frame dumps this trajectory actually has in storage, oldest timestep first.
     * Anything else living under the same prefix — the GLBs, the parquet, the element
     * table — is filtered out by the key pattern.
     */
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
        const parsed = parseFrameForGlb(localRawPath);

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
