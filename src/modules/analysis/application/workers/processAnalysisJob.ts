import { logger } from '@/core/logger';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { createAnalysisExecutionLogSink } from '@/core/runtime/infrastructure/execution-log-streaming';
import { logAndSwallow } from '@/support/error/errorMessage';
import { safeRemovePath } from '@/support/fs/safe-remove-path';
import { AnalysisEnvironment, type AnalysisEnvironmentState } from '@/modules/analysis/application/workflow/AnalysisEnvironment';
import {
    createAnalysisStageReporter,
    type AnalysisStageReportInput
} from '@/modules/analysis/application/workflow/AnalysisStageReporter';
import type { WorkflowRuntime } from '@/modules/analysis/application/workflow/WorkflowRuntime';
import type {
    AnalysisJobMetadata,
    AnalysisQueueJobPayload,
    AnalysisJobExecutionData
} from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';
import type { ArtifactUploadQueue } from '@/modules/plugin/application/artifacts/ArtifactUploadQueue';
import type { ArtifactUploadBatch } from '@/modules/plugin/contracts/artifact-upload';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events';

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
    const job = payload;
    const metadata = job.metadata as AnalysisJobMetadata;
    if (!job.executionDataReference) {
        throw new Error(`Missing executionDataReference for analysis job ${job.jobId}`);
    }

    const executionData = await deps.analysisDataStore.resolve({
        jobId: job.jobId,
        executionDataReference: job.executionDataReference
    });
    const isBatchMode = executionData.batch !== undefined;
    const timestep = isBatchMode ? undefined : (job.timestep ?? metadata.timestep);

    if (!isBatchMode && timestep === undefined) {
        throw new Error(`Missing timestep for analysis job ${job.jobId}`);
    }

    const artifactUploadBatches: ArtifactUploadBatch[] = [];
    const createArtifactUploadBatch = (analysisJobId: string, batchTimestep?: number): ArtifactUploadBatch => {
        const batch = deps.artifactUploadQueue.createBatch({
            analysisId: executionData.identity.analysisId,
            analysisJobId,
            teamId: job.teamId,
            trajectoryId: executionData.identity.trajectoryId,
            timestep: batchTimestep
        });
        artifactUploadBatches.push(batch);
        return batch;
    };

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
                for (const artifactUploadBatch of artifactUploadBatches) {
                    await artifactUploadBatch.cleanup().catch(
                        logAndSwallow('warn', { jobId: job.jobId }, 'Artifact upload batch cleanup failed')
                    );
                }
            }
        },
        async () => {
            if (isBatchMode && executionData.workflow.forEachNodeId) {
                await processForEachBatchFrames({
                    jobId: job.jobId,
                    executionData,
                    metadata,
                    analysisEnvironment: deps.analysisEnvironment,
                    createArtifactUploadBatch,
                    runStage,
                    workflowRuntime: deps.workflowRuntime,
                    daemonJobReporter: deps.daemonJobReporter,
                    stageReporter,
                    updateProgress: setProgress
                });
            } else {
                runtime = await runStage(
                    {
                        stageKey: `${job.jobId}:prepare`,
                        label: 'Prepare timestep',
                        stageType: 'system'
                    },
                    () => deps.analysisEnvironment.prepare(executionData, metadata, timestep)
                );
                await setProgress(10);

                const artifactUploadBatch = createArtifactUploadBatch(job.jobId, timestep);

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
                        isBatchMode,
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
            }
            await setProgress(95);
        }
    );
};

interface ProcessForEachBatchFramesInput {
    jobId: string;
    executionData: AnalysisJobExecutionData;
    metadata: AnalysisJobMetadata;
    analysisEnvironment: AnalysisEnvironment;
    createArtifactUploadBatch: (analysisJobId: string, timestep?: number) => ArtifactUploadBatch;
    runStage: <T>(stage: Omit<AnalysisStageReportInput, 'stageStatus'>, operation: () => Promise<T>) => Promise<T>;
    workflowRuntime: WorkflowRuntime;
    daemonJobReporter: DaemonJobReporter;
    stageReporter: ReturnType<typeof createAnalysisStageReporter>;
    updateProgress: (value: number) => Promise<void>;
}

const processForEachBatchFrames = async ({
    jobId,
    executionData,
    metadata,
    analysisEnvironment,
    createArtifactUploadBatch,
    runStage,
    workflowRuntime,
    daemonJobReporter,
    stageReporter,
    updateProgress
}: ProcessForEachBatchFramesInput): Promise<void> => {
    const dumps = executionData.batch?.trajectoryDumps ?? [];
    const totalFrames = dumps.length;
    if (totalFrames === 0) {
        return;
    }

    const singleFrameExecutionData: AnalysisJobExecutionData = {
        ...executionData,
        batch: undefined
    };
    const referenceDumpCache = new Map<number, string>();
    const frameRuntimes: AnalysisEnvironmentState[] = [];

    try {
        for (let index = 0; index < totalFrames; index += 1) {
            const dump = dumps[index]!;
            const frameMetadata: AnalysisJobMetadata = {
                ...metadata,
                batchMode: undefined,
                inputFile: dump.path,
                timestep: dump.timestep,
                itemIndex: index,
                forEachItem: dump,
                forEachIndex: index
            };
            const frameJobId = `${jobId}-frame-${index}`;
            const artifactUploadBatch = createArtifactUploadBatch(frameJobId, dump.timestep);
            let frameRuntime: AnalysisEnvironmentState | null = null;

            try {
                frameRuntime = await runStage(
                    {
                        stageKey: `${jobId}:prepare:${dump.timestep}`,
                        label: `Prepare frame ${dump.timestep}`,
                        stageType: 'system',
                        timestep: dump.timestep
                    },
                    () => analysisEnvironment.prepare(singleFrameExecutionData, frameMetadata, dump.timestep, {
                        referenceDumpCache
                    })
                );
                frameRuntimes.push(frameRuntime);
                for (const target of frameRuntime.dumpTargets) {
                    if (!referenceDumpCache.has(target.timestep)) {
                        referenceDumpCache.set(target.timestep, target.localPath);
                    }
                }

                await runStage(
                    {
                        stageKey: `${jobId}:workflow:${dump.timestep}`,
                        label: `Execute workflow frame ${dump.timestep}`,
                        stageType: 'system',
                        timestep: dump.timestep
                    },
                    () => workflowRuntime.execute({
                        jobId,
                        executionData: singleFrameExecutionData,
                        outputs: frameRuntime!.outputs,
                        dumpTargets: frameRuntime!.dumpTargets,
                        outputDir: frameRuntime!.outputDir,
                        timestep: dump.timestep,
                        isBatchMode: false,
                        artifactUploadBatch,
                        stageReporter,
                        logSinkFactory: (context) => createAnalysisExecutionLogSink({
                            reporter: daemonJobReporter,
                            jobId,
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

                await runStage(
                    {
                        stageKey: `${jobId}:artifact-enqueue:${dump.timestep}`,
                        label: `Queue artifact uploads frame ${dump.timestep}`,
                        stageType: 'artifact-upload',
                        timestep: dump.timestep
                    },
                    () => artifactUploadBatch.enqueue()
                );
            } catch (error) {
                throw error;
            }

            await updateProgress(10 + Math.round(((index + 1) / totalFrames) * 85));
        }
    } finally {
        const referencePaths = new Set(referenceDumpCache.values());
        await Promise.all([
            ...frameRuntimes.map((frameRuntime) =>
                analysisEnvironment.cleanup(frameRuntime).catch(
                    logAndSwallow('warn', { jobId }, 'Post-frame cleanup failed')
                )
            ),
            ...Array.from(referencePaths).map((localPath) =>
                safeRemovePath(localPath).catch(
                    logAndSwallow('warn', { jobId, localPath }, 'Reference dump cache cleanup failed')
                )
            )
        ]);
    }
};
