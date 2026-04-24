import { logger } from '@/core/logger';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
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

export type AnalysisWorkerJobPayload = AnalysisQueueJobPayload & {
    executionData?: AnalysisJobExecutionData;
    executionDataCompressed?: string;
    executionDataReference?: AnalysisExecutionDataReference;
};

export interface ProcessAnalysisJobDependencies {
    analysisDataStore: AnalysisDataStore;
    analysisEnvironment: AnalysisEnvironment;
    artifactUploadQueue: ArtifactUploadQueue;
    daemonJobReporter: DaemonJobReporter;
    workflowRuntime: WorkflowRuntime;
}

export interface ProcessAnalysisJobHooks {
    updateProgress?: (value: number) => Promise<void> | void;
}

// Extracted from AnalysisWorker.process so it can be reused by the desktop
// SQLite-backed processor without duplicating orchestration logic.
export const processAnalysisJob = async (
    payload: AnalysisQueueJobPayload,
    deps: ProcessAnalysisJobDependencies,
    hooks: ProcessAnalysisJobHooks = {}
): Promise<void> => {
    const job = payload as AnalysisWorkerJobPayload;
    const metadata = job.metadata as AnalysisJobMetadata;
    const executionData = await deps.analysisDataStore.resolve(job);
    const isBatchMode = executionData.batch !== undefined;
    const timestep = isBatchMode ? undefined : (job.timestep ?? metadata.timestep);

    if (!isBatchMode && timestep === undefined) {
        throw new Error(`Missing timestep for analysis job ${job.jobId}`);
    }

    const artifactUploadBatch = deps.artifactUploadQueue.createBatch({
        analysisId: executionData.identity.analysisId,
        analysisJobId: job.jobId,
        teamId: job.teamId,
        trajectoryId: executionData.identity.trajectoryId,
        timestep
    });

    const buildStatusReporter = createLifecycleStatusReporter<BaseAnalysisEventData>(
        {
            started: deps.daemonJobReporter.reportAnalysisStarted,
            completed: deps.daemonJobReporter.reportAnalysisCompleted,
            failed: deps.daemonJobReporter.reportAnalysisFailed
        },
        'analysis'
    );

    let runtime: AnalysisEnvironmentState | null = null;

    const statusPayload: BaseAnalysisEventData = {
        jobId: job.jobId,
        name: job.name,
        analysisId: executionData.identity.analysisId,
        teamId: job.teamId,
        trajectoryId: executionData.identity.trajectoryId,
        timestep
    };
    const reportAnalysisStatus = buildStatusReporter(statusPayload);

    const setProgress = async (value: number) => {
        if (!hooks.updateProgress) return;
        try {
            await hooks.updateProgress(value);
        } catch (error) {
            logger.warn({ err: error, jobId: job.jobId }, 'processAnalysisJob progress callback failed');
        }
    };

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
                    await deps.analysisEnvironment.cleanup(runtime).catch(
                        logAndSwallow('warn', { jobId: job.jobId }, 'Post-job cleanup failed')
                    );
                }
                await artifactUploadBatch.cleanup().catch(
                    logAndSwallow('warn', { jobId: job.jobId }, 'Artifact upload batch cleanup failed')
                );
            }
        },
        async () => {
            runtime = await deps.analysisEnvironment.prepare(executionData, metadata, timestep);
            await setProgress(10);

            await deps.workflowRuntime.execute({
                jobId: job.jobId,
                executionData,
                outputs: runtime.outputs,
                dumpTargets: runtime.dumpTargets,
                outputDir: runtime.outputDir,
                timestep: runtime.dumpTargets[0]!.timestep,
                isBatchMode,
                artifactUploadBatch,
                logSinkFactory: (context) => createAnalysisExecutionLogSink({
                    reporter: deps.daemonJobReporter,
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
            await setProgress(70);

            await artifactUploadBatch.enqueue();
            await setProgress(95);
        }
    );
};
