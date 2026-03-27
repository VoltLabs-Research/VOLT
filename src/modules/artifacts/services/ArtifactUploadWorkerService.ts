import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';

import { logger } from '@/core/logger';
import type { DaemonArtifactReporterService } from '@/modules/cloud-control/services';
import type { DaemonJobReporterService } from '@/modules/cloud-control/services';
import { ARTIFACT_UPLOAD_QUEUE_NAME, QueueService, createMemoryAwareWorkerShell, type MemoryAwareWorkerShell } from '@/modules/platform/services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import { readPositiveIntegerEnv } from '@/shared/utilities/runtime-capacity';
import type { Job } from 'bullmq';

import type { ArtifactUploadBatchJobPayload } from './ArtifactUploadQueueService';

const DEFAULT_ARTIFACT_UPLOAD_CONCURRENCY = readPositiveIntegerEnv('ARTIFACT_UPLOAD_CONCURRENCY') ?? 8;

export class ArtifactUploadWorkerService {
    private readonly workerShell: MemoryAwareWorkerShell<ArtifactUploadBatchJobPayload>;

    constructor(
        private readonly queueService: QueueService,
        private readonly objectStore: ClusterObjectStore,
        private readonly daemonArtifactReporterService: DaemonArtifactReporterService,
        private readonly daemonJobReporterService: DaemonJobReporterService
    ) {
        this.workerShell = createMemoryAwareWorkerShell<ArtifactUploadBatchJobPayload>({
            queueService,
            queueName: ARTIFACT_UPLOAD_QUEUE_NAME,
            startedMessage: 'Artifact upload worker started',
            stoppedMessage: 'Artifact upload worker stopped',
            failedMessage: 'Artifact upload batch failed'
        });
    }

    start(concurrency = DEFAULT_ARTIFACT_UPLOAD_CONCURRENCY): void {
        this.workerShell.start(
            async (jobPayload, bullJob) => this.processBatch(jobPayload, bullJob),
            {
                concurrency,
                onFailed: async (job, error) => {
                    if (!job?.data) {
                        return;
                    }

                    const maxAttempts = typeof job.opts.attempts === 'number'
                        ? job.opts.attempts
                        : 1;

                    if (job.attemptsMade < maxAttempts) {
                        return;
                    }

                    logger.error(
                        {
                            analysisId: job.data.analysisId,
                            batchDirectory: job.data.batchDirectory,
                            err: error,
                            jobId: job.data.jobId,
                            uploads: job.data.uploads.length
                        },
                        'Artifact upload batch exhausted all retry attempts'
                    );
                }
            }
        );
    }

    async stop(): Promise<void> {
        await this.workerShell.stop();
    }

    private async processBatch(payload: ArtifactUploadBatchJobPayload, bullJob: Job<ArtifactUploadBatchJobPayload>): Promise<void> {
        await this.daemonJobReporterService.reportArtifactUploadJobStatus({
            jobId: payload.jobId,
            analysisId: payload.analysisId,
            teamId: payload.teamId,
            trajectoryId: payload.trajectoryId,
            trajectoryName: payload.trajectoryName,
            timestep: payload.timestep,
            status: 'running'
        });

        try {
            logger.info(
                {
                    analysisId: payload.analysisId,
                    artifactCount: payload.uploads.length,
                    batchDirectory: payload.batchDirectory,
                    jobId: payload.jobId
                },
                'Processing staged artifact upload batch'
            );

            for (let index = 0; index < payload.uploads.length; index += 1) {
                const upload = payload.uploads[index]!;
                const fileStat = await fs.stat(upload.sourcePath);

                await this.objectStore.putObjectStream({
                    ownerClusterId: upload.ownerClusterId,
                    bucket: upload.bucket,
                    objectKey: upload.objectKey,
                    stream: createReadStream(upload.sourcePath),
                    size: fileStat.size,
                    metadata: {
                        ...(upload.contentType ? { 'Content-Type': upload.contentType } : {}),
                        ...(upload.contentEncoding ? { 'Content-Encoding': upload.contentEncoding } : {}),
                        ...(upload.metadata ?? {})
                    }
                });

                if (upload.reportArtifact) {
                    await this.daemonArtifactReporterService.reportArtifact(upload.reportArtifact);
                }

                await bullJob.updateProgress(Math.round(((index + 1) / Math.max(1, payload.uploads.length)) * 100));
            }

            this.daemonArtifactReporterService.flushPendingArtifacts();
            await this.daemonJobReporterService.reportArtifactUploadJobStatus({
                jobId: payload.jobId,
                analysisId: payload.analysisId,
                teamId: payload.teamId,
                trajectoryId: payload.trajectoryId,
                trajectoryName: payload.trajectoryName,
                timestep: payload.timestep,
                status: 'completed'
            });
            await this.cleanupBatchDirectory(payload.batchDirectory);
        } catch (error) {
            const maxAttempts = typeof bullJob.opts.attempts === 'number' ? bullJob.opts.attempts : 1;
            const willExhaustAttempts = bullJob.attemptsMade + 1 >= maxAttempts;

            if (willExhaustAttempts) {
                this.daemonArtifactReporterService.flushPendingArtifacts();
                await this.daemonJobReporterService.reportArtifactUploadJobStatus({
                    jobId: payload.jobId,
                    analysisId: payload.analysisId,
                    teamId: payload.teamId,
                    trajectoryId: payload.trajectoryId,
                    trajectoryName: payload.trajectoryName,
                    timestep: payload.timestep,
                    status: 'failed',
                    error: error instanceof Error ? error.message : String(error)
                }).catch(() => {});

                await this.cleanupBatchDirectory(payload.batchDirectory);
            }

            throw error;
        }
    }
    private async cleanupBatchDirectory(batchDirectory: string): Promise<void> {
        await fs.rm(batchDirectory, { recursive: true, force: true }).catch((error) => {
            logger.warn({ batchDirectory, err: error }, 'Failed to cleanup artifact upload batch directory');
        });
    }
}
