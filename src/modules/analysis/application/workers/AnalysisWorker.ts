import { type Job as BullMQJob } from 'bullmq';

import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import { QueueService } from '@/core/queues/application/QueueService';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { createAnalysisExecutionLogSink } from '@/core/runtime/infrastructure/execution-log-streaming';
import { logAndSwallow } from '@/support/error/errorMessage';
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
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events';

type AnalysisWorkerJobPayload = AnalysisQueueJobPayload & {
    executionData?: AnalysisJobExecutionData;
    executionDataCompressed?: string;
    executionDataReference?: AnalysisExecutionDataReference;
};

@Service('analysisWorker')
export class AnalysisWorker extends BaseWorker<AnalysisQueueJobPayload> {
    protected readonly queueName = ANALYSIS_QUEUE_NAME;

    private readonly buildStatusReporter: ReturnType<typeof createLifecycleStatusReporter<BaseAnalysisEventData>>;

    constructor(
        queueService: QueueService,
        private readonly analysisDataStore: AnalysisDataStore,
        private readonly analysisEnvironment: AnalysisEnvironment,
        private readonly artifactUploadQueue: ArtifactUploadQueue,
        private readonly daemonJobReporter: DaemonJobReporter,
        private readonly workflowRuntime: WorkflowRuntime
    ) {
        super({ queueService });
        this.buildStatusReporter = createLifecycleStatusReporter<BaseAnalysisEventData>(
            {
                started: daemonJobReporter.reportAnalysisStarted,
                completed: daemonJobReporter.reportAnalysisCompleted,
                failed: daemonJobReporter.reportAnalysisFailed
            },
            'analysis'
        );
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

        const statusPayload: BaseAnalysisEventData = {
            jobId: job.jobId,
            name: job.name,
            analysisId: executionData.identity.analysisId,
            teamId: job.teamId,
            trajectoryId: executionData.identity.trajectoryId,
            timestep
        };
        const reportAnalysisStatus = this.buildStatusReporter(statusPayload);

        await withJobLifecycle(
            {
                reportStatus: (status, error) => {
                    // started is reported by the dispatcher that enqueues the job.
                    if (status === 'started') return;
                    if (status === 'failed') {
                        logger.error(`Analysis job failed for jobId=${job.jobId}: ${error ?? 'Unknown error'}`);
                    }
                    reportAnalysisStatus(status, error);
                },
                cleanup: async () => {
                    if (runtime) {
                        await this.analysisEnvironment.cleanup(runtime).catch(
                            logAndSwallow('warn', { jobId: job.jobId }, 'Post-job cleanup failed')
                        );
                    }
                    await artifactUploadBatch.cleanup().catch(
                        logAndSwallow('warn', { jobId: job.jobId }, 'Artifact upload batch cleanup failed')
                    );
                }
            },
            async () => {
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
            }
        );
    }
}
