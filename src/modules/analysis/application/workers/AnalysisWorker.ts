import { DelayedError, type Job as BullMQJob } from 'bullmq';

import { logger } from '@/core/logger';
import { BaseWorker, type QueueScopeConstraint } from '@/core/queues/application/BaseWorker';
import { QueueService } from '@/core/queues/application/QueueService';
import type { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import { createAnalysisExecutionLogSink } from '@/core/runtime/infrastructure/execution-log-streaming';
import { AnalysisEnvironment, type AnalysisEnvironmentState } from '@/modules/analysis/application/workflow/AnalysisEnvironment';
import type { WorkflowRuntime } from '@/modules/analysis/application/workflow/WorkflowRuntime';
import type {
    AnalysisExecutionDataReference,
    AnalysisJobExecutionData,
    AnalysisJobMetadata,
    AnalysisQueueJobPayload
} from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';
import type { ArtifactUploadQueue } from '@/modules/plugin/application/artifacts/ArtifactUploadQueue';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';

type AnalysisWorkerJobPayload = AnalysisQueueJobPayload & {
    executionData?: AnalysisJobExecutionData;
    executionDataCompressed?: string;
    executionDataReference?: AnalysisExecutionDataReference;
};

export class AnalysisWorker extends BaseWorker<AnalysisQueueJobPayload> {
    protected readonly queueName = ANALYSIS_QUEUE_NAME;

    constructor(
        queueService: QueueService,
        redisConnection: RedisConnection,
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly analysisDataStore: AnalysisDataStore,
        private readonly analysisEnvironment: AnalysisEnvironment,
        private readonly artifactUploadQueue: ArtifactUploadQueue,
        private readonly daemonJobReporter: DaemonJobReporter,
        private readonly workflowRuntime: WorkflowRuntime
    ) {
        super({ queueService, redisConnection });
    }

    protected scopeConstraints(payload: AnalysisQueueJobPayload): QueueScopeConstraint[] {
        const limits = this.queueScopeLimitsRegistry.getSnapshot().analysisProcessing;
        const metadata = payload.metadata as AnalysisJobMetadata;

        return [
            { scope: 'trajectory', scopeId: metadata.trajectoryId, limit: limits.maxRunningPerTrajectory },
            { scope: 'team', scopeId: payload.teamId, limit: limits.maxRunningPerTeam }
        ];
    }

    protected async process(payload: AnalysisQueueJobPayload, bullJob: BullMQJob<AnalysisQueueJobPayload>): Promise<void> {
        const job = payload as AnalysisWorkerJobPayload;
        const metadata = job.metadata as AnalysisJobMetadata;
        const executionData = await this.analysisDataStore.resolve(job);
        const isBatchMode = executionData.batch !== undefined;
        const timestep = isBatchMode ? undefined : (job.timestep ?? metadata.timestep);

        if (!isBatchMode && timestep === undefined) {
            throw new Error(`Missing timestep for analysis job ${job.jobId}`);
        }

        const artifactUploadBatch = this.artifactUploadQueue.createBatch({
            analysisId: executionData.identity.analysisId,
            analysisJobId: job.jobId,
            teamId: job.teamId,
            trajectoryId: executionData.identity.trajectoryId,
            timestep
        });
        let runtime: AnalysisEnvironmentState | null = null;

        try {
            runtime = await this.analysisEnvironment.prepare(executionData, metadata, timestep);
            await bullJob.updateProgress(10);

            await this.workflowRuntime.execute({
                jobId: job.jobId,
                executionData,
                outputs: runtime.outputs,
                dumpTargets: runtime.dumpTargets,
                outputDir: runtime.outputDir,
                timestep: runtime.dumpTargets[0]!.timestep,
                isBatchMode,
                artifactUploadBatch,
                logSinkFactory: (context) => createAnalysisExecutionLogSink({
                    reporter: this.daemonJobReporter,
                    jobId: job.jobId,
                    analysisId: executionData.identity.analysisId,
                    teamId: executionData.identity.teamId,
                    trajectoryId: executionData.identity.trajectoryId,
                    timesteps: context.timesteps,
                    metadata: {
                        nodeId: context.nodeId,
                        nodeType: context.nodeType,
                        pluginId: context.pluginId,
                        executionPath: context.executionPath
                    }
                })
            });
            await bullJob.updateProgress(70);

            await artifactUploadBatch.enqueue();
            await bullJob.updateProgress(95);

            await this.daemonJobReporter.reportAnalysisCompleted({
                jobId: job.jobId,
                name: job.name,
                analysisId: executionData.identity.analysisId,
                teamId: job.teamId,
                timestep
            });
            await bullJob.updateProgress(100);
        } catch (error) {
            if (error instanceof DelayedError) {
                throw error;
            }

            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Analysis job failed for jobId=${job.jobId}: ${message}`);
            await this.daemonJobReporter.reportAnalysisFailed({
                jobId: job.jobId,
                name: job.name,
                analysisId: executionData.identity.analysisId,
                teamId: job.teamId,
                timestep,
                error: message
            });

            throw error;
        } finally {
            if (runtime) {
                await this.analysisEnvironment.cleanup(runtime).catch((err) => {
                    logger.warn(`Post-job cleanup failed for jobId=${job.jobId}: ${err instanceof Error ? err.message : String(err)}`);
                });
            }
            await artifactUploadBatch.cleanup().catch((err) => {
                logger.warn(`Artifact upload batch cleanup failed for jobId=${job.jobId}: ${err instanceof Error ? err.message : String(err)}`);
            });
        }
    }
}
