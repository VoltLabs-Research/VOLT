import { logger } from '@/core/logger';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { createAnalysisExecutionLogSink } from '@/core/runtime/infrastructure/execution-log-streaming';
import { logAndSwallow } from '@/support/error/errorMessage';
import type { AnalysisQueueAdmissionController } from '@/modules/analysis/application/analysis/AnalysisQueueAdmissionController';
import { AnalysisEnvironment, type AnalysisEnvironmentState } from '@/modules/analysis/application/workflow/AnalysisEnvironment';
import {
    createAnalysisStageReporter,
    type AnalysisStageReportInput
} from '@/modules/analysis/application/workflow/AnalysisStageReporter';
import type { WorkflowRuntime } from '@/modules/analysis/application/workflow/WorkflowRuntime';
import type {
    AnalysisJobMetadata,
    AnalysisQueueJobPayload
} from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';
import type { ArtifactUploadQueue } from '@/modules/plugin/application/artifacts/ArtifactUploadQueue';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events';

export interface ProcessAnalysisJobDependencies {
    analysisDataStore: AnalysisDataStore;
    analysisEnvironment: AnalysisEnvironment;
    artifactUploadQueue: ArtifactUploadQueue;
    daemonJobReporter: DaemonJobReporter;
    workflowRuntime: WorkflowRuntime;
    analysisQueueAdmissionController: AnalysisQueueAdmissionController;
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
    const job = payload;
    const metadata = job.metadata as AnalysisJobMetadata;
    if (!job.executionDataReference) {
        throw new Error(`Missing executionDataReference for analysis job ${job.jobId}`);
    }

    const executionData = await deps.analysisDataStore.resolve({
        jobId: job.jobId,
        executionDataReference: job.executionDataReference
    });
    const timestep = job.timestep ?? metadata.timestep;

    if (timestep === undefined) {
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
    const stageReporter = createAnalysisStageReporter(deps.daemonJobReporter, statusPayload);

    const runStage = async <T>(
        stage: Omit<AnalysisStageReportInput, 'stageStatus'>,
        operation: () => Promise<T>
    ): Promise<T> => {
        await stageReporter.report({ ...stage, stageStatus: 'running' });
        try {
            const result = await operation();
            await stageReporter.report({ ...stage, stageStatus: 'completed' });
            return result;
        } catch (error) {
            await stageReporter.report({
                ...stage,
                stageStatus: 'failed',
                detail: error instanceof Error ? error.message : undefined
            });
            throw error;
        }
    };

    const setProgress = async (value: number) => {
        if (!hooks.updateProgress) return;
        try {
            await hooks.updateProgress(value);
        } catch (error) {
            logger.warn({ err: error, jobId: job.jobId }, 'processAnalysisJob progress callback failed');
        }
    };

    try {
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
                runtime = await runStage(
                    {
                        stageKey: `${job.jobId}:prepare`,
                        label: 'Prepare timestep',
                        stageType: 'system'
                    },
                    () => deps.analysisEnvironment.prepare(executionData, metadata, timestep)
                );
                await setProgress(10);

                await runStage(
                    {
                        stageKey: `${job.jobId}:workflow`,
                        label: 'Execute workflow',
                        stageType: 'system'
                    },
                    () => deps.workflowRuntime.execute({
                        jobId: job.jobId,
                        executionData,
                        outputs: runtime!.outputs,
                        dumpTargets: runtime!.dumpTargets,
                        outputDir: runtime!.outputDir,
                        timestep: runtime!.dumpTargets[0]!.timestep,
                        artifactUploadBatch,
                        stageReporter,
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
                    })
                );
                await setProgress(70);

                await runStage(
                    {
                        stageKey: `${job.jobId}:artifact-enqueue`,
                        label: 'Queue artifact uploads',
                        stageType: 'artifact-upload'
                    },
                    () => artifactUploadBatch.enqueue()
                );
                await setProgress(95);
            }
        );
    } finally {
        const analysisId = job.analysisId ?? executionData.identity.analysisId;
        await deps.analysisQueueAdmissionController.enqueueNextDeferredJob(analysisId).catch(
            logAndSwallow('warn', { jobId: job.jobId, analysisId }, 'Deferred analysis admission failed')
        );
    }
};
