import { logger } from '@/core/logger';
import { isMemoryPressured } from '@/core/memory';
import { ObjectBucketName } from '@/shared/contracts';
import { SSH_IMPORT_FRAME_QUEUE_NAME } from '@/modules/platform/services';
import type { MinioService, QueueService } from '@/modules/platform/services';
import type { GlbExporterService } from '@/modules/trajectory-native/services';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { DelayedError, type Job, type Worker } from 'bullmq';

export interface ImportedFrameRecord {
    timestep: number;
    natoms: number;
    simulationCell: Record<string, unknown> | null;
    size: number;
};

export interface SSHImportFrameJobPayload extends Record<string, unknown> {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName: string;
    timestep: number;
    natoms: number;
    simulationCell: Record<string, unknown> | null;
    size: number;
    sourceFilePath: string;
    objectKey: string;
};

export class SSHImportFrameWorkerService {
    private worker: Worker<SSHImportFrameJobPayload, ImportedFrameRecord> | null = null;

    constructor(
        private readonly queueService: QueueService,
        private readonly minioService: MinioService,
        private readonly glbExporterService: GlbExporterService
    ) {
    }

    start(concurrency?: number): void {
        if (this.worker) {
            return;
        }

        this.worker = this.queueService.createWorker<SSHImportFrameJobPayload, ImportedFrameRecord>(
            SSH_IMPORT_FRAME_QUEUE_NAME,
            async (jobPayload, job) => this.processJob(jobPayload, job),
            {
                concurrency: concurrency ?? 2,
                lockDurationMs: 120_000
            }
        );

        this.worker.on('failed', (job, error) => {
            logger.error(
                {
                    err: error,
                    jobId: job?.data?.jobId,
                    timestep: job?.data?.timestep,
                    trajectoryId: job?.data?.trajectoryId
                },
                'BullMQ SSH import frame job failed'
            );
        });

        logger.info('SSHImportFrameWorkerService started');
    }

    async stop(): Promise<void> {
        if (!this.worker) {
            return;
        }

        await this.worker.close();
        this.worker = null;
        logger.info('SSHImportFrameWorkerService stopped');
    }

    private async processJob(
        job: SSHImportFrameJobPayload,
        bullJob: Job<SSHImportFrameJobPayload>
    ): Promise<ImportedFrameRecord> {
        if (isMemoryPressured()) {
            const delayMs = 15_000;
            logger.warn(
                {
                    delayMs,
                    jobId: job.jobId,
                    timestep: job.timestep,
                    trajectoryId: job.trajectoryId
                },
                'Heap memory pressure detected — delaying SSH import frame job'
            );
            await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
            throw new DelayedError();
        }

        const tempGzPath = `${job.sourceFilePath}.gz`;

        try {
            await pipeline(
                createReadStream(job.sourceFilePath),
                zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED }),
                createWriteStream(tempGzPath)
            );

            const gzStat = await fs.stat(tempGzPath);
            await this.minioService.putObjectStream({
                bucket: ObjectBucketName.Dumps,
                objectKey: job.objectKey,
                stream: createReadStream(tempGzPath),
                size: gzStat.size,
                metadata: {
                    'Content-Encoding': 'gzip',
                    'Content-Type': 'application/gzip'
                }
            });

            await this.glbExporterService.preprocessTrajectory({
                teamId: job.teamId,
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                timestep: job.timestep,
                objectKey: job.objectKey
            });

            return {
                timestep: job.timestep,
                natoms: job.natoms,
                simulationCell: job.simulationCell,
                size: job.size
            };
        } finally {
            await fs.unlink(tempGzPath).catch(() => {});
        }
    }
}
