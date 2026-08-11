import { logger } from '@shared/infrastructure/logger';
import { createLifecycleStatusReporter } from '@shared/infrastructure/queues/create-status-reporter';
import { withJobLifecycle } from '@shared/infrastructure/queues/with-job-lifecycle';
import { createAnalysisExecutionLogSink } from '@shared/infrastructure/runtime/execution-log-streaming';
import { logAndSwallow } from '@shared/application/utilities/error-message';
import type { AnalysisQueueAdmissionController } from '@modules/analysis/services/AnalysisQueueAdmissionController';
import { AnalysisEnvironment, type AnalysisEnvironmentState } from '@modules/analysis/services/workflow/AnalysisEnvironment';
import { createAnalysisStageReporter } from '@modules/analysis/services/workflow/AnalysisStageReporter';
import { type AnalysisStageReportInput } from '@shared/contracts/types/analysis-stage-reporter';
import type { WorkflowRuntime } from '@modules/analysis/services/workflow/WorkflowRuntime';
import { readWorkflowTrace, type InlineWorkflowTraceNode } from '@modules/analysis/services/workflow/WorkflowWalker';
import { buildTraceLogSegments } from '@modules/analysis/services/workflow/trace-log-segments';
import type {
    AnalysisJobMetadata,
    AnalysisQueueJobPayload
} from '@shared/contracts/types/http-analysis';
import type { AnalysisDataStore } from '@modules/analysis/services/AnalysisDataStore';
import type { ArtifactUploadQueue } from '@modules/plugin/services/artifacts/ArtifactUploadQueue';
import type { DaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import type { BaseAnalysisEventData } from '@modules/analysis/events/analysis-events';
import type { AnalysisProvenanceCollector } from '@modules/analysis/services/AnalysisProvenanceCollector';

interface ProcessAnalysisJobDependencies {
    analysisDataStore: AnalysisDataStore;
    analysisEnvironment: AnalysisEnvironment;
    artifactUploadQueue: ArtifactUploadQueue;
    daemonJobReporter: DaemonJobReporter;
    workflowRuntime: WorkflowRuntime;
    analysisQueueAdmissionController: AnalysisQueueAdmissionController;
    analysisProvenanceCollector: AnalysisProvenanceCollector;
}

export const processAnalysisJob = async (
    payload: AnalysisQueueJobPayload,
    deps: ProcessAnalysisJobDependencies
): Promise<void> => {
    const job = payload;
    const metadata = job.metadata as AnalysisJobMetadata;
    if (!job.executionDataReference) {
        throw new Error(`Missing executionDataReference for analysis job ${job.jobId}`);
    }

    const jobStartedAt = Date.now();

    const executionData = await deps.analysisDataStore.get(job.executionDataReference, job.jobId);
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
        await stageReporter.report({
            ...stage,
            stageStatus: 'running'
        });
        try {
            const result = await operation();
            await stageReporter.report({
                ...stage,
                stageStatus: 'completed'
            });
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

    try {
        await withJobLifecycle(
            {
                reportStatus: (status, error) => {
                    if (status === 'failed') {
                        logger.error(`Analysis job failed for jobId=${job.jobId}: ${error ?? 'Unknown error'}`);
                    }

                    /*
                     * `started` used to return here, so a running frame never reached the
                     * control plane and its projected job sat at `queued` until it
                     * completed. See the same change in `processPipelineJob`.
                     */
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
                const prepared = await runStage(
                    {
                        stageKey: `${job.jobId}:prepare`,
                        label: 'Prepare timestep',
                        stageType: 'system'
                    },
                    () => deps.analysisEnvironment.prepare(executionData, metadata, timestep)
                );
                runtime = prepared;

                const emitExecutionTrace = async (
                    trace: InlineWorkflowTraceNode[],
                    success: boolean
                ): Promise<void> => {
                    const segments = buildTraceLogSegments(trace, { success });
                    if (segments.length === 0) {
                        return;
                    }

                    await deps.daemonJobReporter.reportAnalysisLogChunk({
                        analysisId: executionData.identity.analysisId,
                        jobId: job.jobId,
                        teamId: job.teamId,
                        trajectoryId: executionData.identity.trajectoryId,
                        timestep,
                        segments
                    }).catch(
                        logAndSwallow('warn', {
                            jobId: job.jobId,
                            analysisId: executionData.identity.analysisId
                        }, 'Failed to report execution trace; trace segments were lost')
                    );
                };

                let workflowOutcome: { trace: InlineWorkflowTraceNode[] };
                try {
                    workflowOutcome = await runStage(
                        {
                            stageKey: `${job.jobId}:workflow`,
                            label: 'Execute workflow',
                            stageType: 'system'
                        },
                        () => deps.workflowRuntime.execute({
                            jobId: job.jobId,
                            executionData,
                            outputs: prepared.outputs,
                            dumpTargets: prepared.dumpTargets,
                            primaryFrameIndex: prepared.primaryFrameIndex,
                            outputDir: prepared.outputDir,
                            timestep: prepared.dumpTargets[prepared.primaryFrameIndex].timestep,
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
                } catch (error) {
                    await emitExecutionTrace(readWorkflowTrace(error) ?? [], false);
                    throw error;
                }

                await emitExecutionTrace(workflowOutcome.trace, true);

                await deps.analysisProvenanceCollector.recordCompletion({
                    executionData,
                    metadata,
                    startedAt: jobStartedAt,
                    outputArtifactIds: []
                }).catch(logAndSwallow('warn', {
                    jobId: job.jobId,
                    analysisId: executionData.identity.analysisId
                }, 'Provenance recording failed'));

                await runStage(
                    {
                        stageKey: `${job.jobId}:artifact-enqueue`,
                        label: 'Queue artifact uploads',
                        stageType: 'artifact-upload'
                    },
                    () => artifactUploadBatch.enqueue()
                );
            }
        );
    } finally {
        const analysisId = job.analysisId ?? executionData.identity.analysisId;
        await deps.analysisQueueAdmissionController.enqueueNextDeferredJob(analysisId).catch(
            logAndSwallow('error', {
                jobId: job.jobId,
                analysisId
            }, 'Deferred analysis admission failed; remaining deferred frames will not run')
        );
    }
};
