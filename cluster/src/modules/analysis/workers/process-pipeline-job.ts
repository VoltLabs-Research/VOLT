import { toTrajectoryFrameDumpObjectKey } from '@shared/infrastructure/storage/storage-codec';
import path from 'node:path';
import fs from 'node:fs/promises';
import { dir as createTempDir } from 'tmp-promise';

import { logger } from '@shared/infrastructure/logger';
import { DAEMON_PATHS } from '@core/config/paths';
import { createLifecycleStatusReporter } from '@shared/infrastructure/queues/create-status-reporter';
import { withJobLifecycle } from '@shared/infrastructure/queues/with-job-lifecycle';
import { createAnalysisExecutionLogSink } from '@shared/infrastructure/runtime/execution-log-streaming';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { logAndSwallow } from '@shared/application/utilities/error-message';
import { safeRemovePath } from '@shared/infrastructure/utilities/safe-remove-path';
import { downloadCompressedDump } from '@modules/analysis/services/workflow/dump-download';
import { AnalysisEnvironment, type AnalysisSeedMetadata } from '@modules/analysis/services/workflow/AnalysisEnvironment';
import { createAnalysisStageReporter } from '@modules/analysis/services/workflow/AnalysisStageReporter';
import type { WorkflowRuntime } from '@modules/analysis/services/workflow/WorkflowRuntime';
import { createWorkflowExposureOutputFilePath } from '@modules/analysis/services/workflow/exposure-payload-reader';
import {
    createPipelineContext,
    registerSharedExposure,
    resolveSharedExposure
} from '@modules/analysis/services/pipeline-context';
import type { PipelineContext } from '@shared/contracts/types/pipeline-context';
import type { DumpTransformService } from '@modules/analysis/services/dump-transform';
import type { PipelineSharedExposureStore } from '@modules/analysis/services/PipelineSharedExposureStore';
import type {
    AnalysisJobExecutionData,
    AnalysisValueMap,
    PipelinePlannedStage,
    PipelineQueueJobPayload
} from '@shared/contracts/types/http-analysis';
import type { AnalysisDataStore } from '@modules/analysis/services/AnalysisDataStore';
import type { ArtifactUploadQueue } from '@modules/plugin/services/artifacts/ArtifactUploadQueue';
import type { DaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import type { BaseAnalysisEventData } from '@modules/analysis/events/analysis-events';

interface ProcessPipelineJobDependencies {
    analysisDataStore: AnalysisDataStore;
    analysisEnvironment: AnalysisEnvironment;
    artifactUploadQueue: ArtifactUploadQueue;
    daemonJobReporter: DaemonJobReporter;
    workflowRuntime: WorkflowRuntime;
    dumpTransformService: DumpTransformService;
    pipelineSharedExposureStore: PipelineSharedExposureStore;
    objectStore: ClusterObjectStore;
}

/** Everything the stages of one pipeline job share: the job, its services and the dump they pass along. */
interface PipelineStageRun {
    payload: PipelineQueueJobPayload;
    deps: ProcessPipelineJobDependencies;
    context: PipelineContext;
    storageClusterId: string;
    workingDump: string;
    reportedAnalysisIds: Set<string>;
}

const ATOMS_PARQUET_SUFFIX = 'atoms.parquet';

const ANNOTATED_DUMP_SUFFIX = 'annotated.dump';

const WORKING_DUMP_EXPOSURE_ID = '__working_dump__';

export const processPipelineJob = async (
    payload: PipelineQueueJobPayload,
    deps: ProcessPipelineJobDependencies
): Promise<void> => {
    const { timestep, storageClusterId } = payload;
    if (!storageClusterId) {
        throw new Error(`Pipeline job ${payload.jobId} is missing a storage cluster`);
    }

    await fs.mkdir(DAEMON_PATHS.analysisOutput, { recursive: true });
    const pipelineTemp = await createTempDir({
        tmpdir: DAEMON_PATHS.analysisOutput,
        prefix: `pipeline-${payload.trajectoryId}-${timestep}-`,
        unsafeCleanup: true
    });
    const pipelineTempPath = pipelineTemp.path;
    const run: PipelineStageRun = {
        payload,
        deps,
        context: createPipelineContext(pipelineTempPath),
        storageClusterId,
        workingDump: path.join(pipelineTempPath, 'working.dump'),
        reportedAnalysisIds: new Set<string>()
    };

    try {
        const downloadedDump = await downloadCompressedDump(
            deps.objectStore,
            toTrajectoryFrameDumpObjectKey(payload.trajectoryId, timestep),
            storageClusterId,
            DAEMON_PATHS.analysisDumps
        );
        await fs.copyFile(downloadedDump, run.workingDump);
        await safeRemovePath(downloadedDump);

        for (let index = 0; index < payload.stages.length; index += 1) {
            const stage = payload.stages[index];
            const stageDir = path.join(pipelineTempPath, `stage-${index}`);

            switch (stage.kind) {
                case 'slice':
                    await deps.dumpTransformService.slice(run.workingDump, stage.config ?? {});
                    break;
                case 'expression':
                    await deps.dumpTransformService.select(run.workingDump, readExpression(stage.config));
                    break;
                case 'plugin':
                    await (stage.cacheHit
                        ? runCacheHitStage(run, stage, index, stageDir)
                        : runComputeStage(run, stage, stageDir));
                    break;
            }
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Pipeline stage failed';
        for (const stage of payload.stages) {
            const analysisId = stage.analysisId;
            if (stage.kind !== 'plugin' || stage.cacheHit || analysisId === undefined
                || run.reportedAnalysisIds.has(analysisId)) {
                continue;
            }

            await deps.daemonJobReporter.reportAnalysisFailed({
                ...buildStatusPayload(payload, analysisId, `${payload.jobId}:${analysisId}`),
                error: message
            }).catch(logAndSwallow('warn', {
                jobId: payload.jobId,
                analysisId
            }, 'Failed to report pipeline stage failure'));
        }
        throw error;
    } finally {
        await pipelineTemp.cleanup().catch(
            logAndSwallow('warn', { jobId: payload.jobId }, 'Pipeline temp cleanup failed')
        );
    }
};

const readExpression = (config: AnalysisValueMap | undefined): string => {
    const expression = config?.expression;
    if (typeof expression !== 'string' || expression.length === 0) {
        throw new Error('Pipeline expression stage is missing its `expression` config');
    }
    return expression;
};

/**
 * Restores a stage that a previous analysis already computed: its shared exposures come
 * back from the store, and the working dump either comes back with them or is rebuilt by
 * merging the per-atom exposures back in.
 */
const runCacheHitStage = async (
    run: PipelineStageRun,
    stage: PipelinePlannedStage,
    stageIndex: number,
    stageDir: string
): Promise<void> => {
    const { payload, deps, context, storageClusterId, workingDump } = run;
    const sourceAnalysisId = stage.cacheSourceAnalysisId;
    if (!sourceAnalysisId) {
        throw new Error('Pipeline cache-hit stage is missing cacheSourceAnalysisId');
    }

    await fs.mkdir(stageDir, { recursive: true });
    const fetchShared = (exposureId: string): Promise<string | null> => deps.pipelineSharedExposureStore.fetch({
        ownerClusterId: storageClusterId,
        trajectoryId: payload.trajectoryId,
        analysisId: sourceAnalysisId,
        exposureId,
        timestep: payload.timestep,
        destinationDir: stageDir
    });

    for (const exposureId of stage.sharedExposureIds ?? []) {
        const localPath = await fetchShared(exposureId);
        if (!localPath) {
            throw new Error(
                `Pipeline cache hit for analysis ${sourceAnalysisId} has no persisted shared exposure "${exposureId}" at timestep ${payload.timestep}`
            );
        }
        registerSharedExposure(context, exposureId, localPath);
    }

    const restoredDump = await fetchShared(WORKING_DUMP_EXPOSURE_ID);
    if (restoredDump) {
        await fs.copyFile(restoredDump, workingDump);
    } else {
        for (const exposureId of stage.sharedExposureIds ?? []) {
            const resolved = resolveSharedExposure(context, exposureId);
            if (resolved && resolved.endsWith(ATOMS_PARQUET_SUFFIX)) {
                await deps.dumpTransformService.merge(workingDump, resolved);
            }
        }
    }

    await createAnalysisStageReporter(
        deps.daemonJobReporter,
        buildStatusPayload(payload, sourceAnalysisId)
    ).report({
        stageKey: `${payload.jobId}:stage-${stageIndex}:cache`,
        label: stage.pluginDisplayName ?? stage.pluginId ?? 'Cached stage',
        stageType: 'system',
        stageStatus: 'cached',
        timestep: payload.timestep,
        cacheHit: true,
        detail: `Reused analysis ${sourceAnalysisId}`
    });
};

const runComputeStage = async (
    run: PipelineStageRun,
    stage: PipelinePlannedStage,
    stageDir: string
): Promise<void> => {
    const { payload, deps, context } = run;
    if (!stage.executionDataReference || !stage.analysisId) {
        throw new Error('Pipeline compute stage is missing its executionData reference');
    }
    const analysisId = stage.analysisId;

    const executionData = await deps.analysisDataStore.get(stage.executionDataReference, payload.jobId);
    const stageJobId = `${payload.jobId}:${analysisId}`;
    const statusPayload = buildStatusPayload(payload, analysisId, stageJobId, stage.pluginDisplayName);

    const buildStatusReporter = createLifecycleStatusReporter<BaseAnalysisEventData>(
        {
            started: deps.daemonJobReporter.reportAnalysisStarted,
            completed: deps.daemonJobReporter.reportAnalysisCompleted,
            failed: deps.daemonJobReporter.reportAnalysisFailed
        },
        'analysis'
    );
    const reportAnalysisStatus = buildStatusReporter(statusPayload);
    const stageReporter = createAnalysisStageReporter(deps.daemonJobReporter, statusPayload);

    const artifactUploadBatch = deps.artifactUploadQueue.createBatch({
        analysisId,
        analysisJobId: stageJobId,
        teamId: payload.teamId,
        trajectoryId: payload.trajectoryId,
        timestep: payload.timestep
    });

    const metadata: AnalysisSeedMetadata = {
        forEachItem: { timestep: payload.timestep },
        forEachIndex: 0
    };

    await withJobLifecycle(
        {
            reportStatus: (status, error) => {
                if (status === 'failed') {
                    logger.error(`Pipeline compute stage failed for jobId=${stageJobId}: ${error ?? 'Unknown error'}`);
                }

                /*
                 * `started` used to return here, which meant a frame being computed was
                 * never reported as running: the control plane's projection went straight
                 * from `queued` to `completed`, so the timeline could only ever show a
                 * frame as pending or finished while the analysis row beside it already
                 * said running. `AnalysisStartedEvent` maps to a per-frame
                 * `analysis-job-status` message whose dedupe key includes the timestep,
                 * so this reports one `running` per frame rather than re-announcing the
                 * analysis.
                 *
                 * Only terminal reports may enter `reportedAnalysisIds` — the outer catch
                 * uses it to avoid double-reporting a failure, and marking an analysis on
                 * `started` would suppress the real one.
                 */
                if (status !== 'started') {
                    run.reportedAnalysisIds.add(analysisId);
                }

                reportAnalysisStatus(status, error);
            },
            cleanup: async () => {
                await artifactUploadBatch.cleanup().catch(
                    logAndSwallow('warn', { jobId: stageJobId }, 'Artifact upload batch cleanup failed')
                );
            }
        },
        async () => {
            const runtime = await deps.analysisEnvironment.prepareWithDump(
                executionData,
                metadata,
                payload.timestep,
                run.workingDump,
                stageDir
            );

            await deps.workflowRuntime.execute({
                jobId: stageJobId,
                executionData,
                outputs: runtime.outputs,
                dumpTargets: runtime.dumpTargets,
                primaryFrameIndex: runtime.primaryFrameIndex,
                outputDir: runtime.outputDir,
                timestep: payload.timestep,
                artifactUploadBatch,
                stageReporter,
                pipelineContext: context,
                logSinkFactory: (logContext) => createAnalysisExecutionLogSink({
                    reporter: deps.daemonJobReporter,
                    jobId: stageJobId,
                    analysisId,
                    teamId: payload.teamId,
                    trajectoryId: payload.trajectoryId,
                    timesteps: logContext.timesteps,
                    metadata: {
                        nodeId: logContext.nodeId,
                        nodeType: logContext.nodeType,
                        pluginId: logContext.pluginId,
                        executionPath: logContext.executionPath
                    }
                })
            });

            await registerStageExposures(run, executionData, analysisId, runtime.outputDir);
            await artifactUploadBatch.enqueue();
        }
    );
};

/**
 * Publishes what the stage produced to the rest of the pipeline: shared exposures by id,
 * and the working dump advanced either from the annotated dump the plugin wrote or by
 * merging its per-atom property tables back in.
 */
const registerStageExposures = async (
    run: PipelineStageRun,
    executionData: AnalysisJobExecutionData,
    analysisId: string,
    outputDir: string
): Promise<void> => {
    const { payload, deps, context, workingDump } = run;
    const { exposures } = executionData.workflow;
    const { storageClusterId, trajectoryId } = executionData.identity;
    const persistShared = (exposureId: string, sourcePath: string): Promise<void> | undefined =>
        storageClusterId === undefined
            ? undefined
            : deps.pipelineSharedExposureStore.persist({
                ownerClusterId: storageClusterId,
                trajectoryId,
                analysisId,
                exposureId,
                timestep: payload.timestep,
                sourcePath
            });

    for (const exposure of exposures) {
        if (!exposure.id || exposure.id.length === 0) {
            continue;
        }
        const filePath = createWorkflowExposureOutputFilePath(outputDir, exposure.results);
        try {
            await fs.access(filePath);
        } catch {
            continue;
        }
        registerSharedExposure(context, exposure.id, filePath);
        await persistShared(exposure.id, filePath);
    }

    const annotatedDump = `${outputDir}_${ANNOTATED_DUMP_SUFFIX}`;
    let annotatedDumpExists = true;
    try {
        await fs.access(annotatedDump);
    } catch {
        annotatedDumpExists = false;
    }

    let advancedFromAnnotatedDump = false;
    if (annotatedDumpExists) {
        try {
            await fs.copyFile(annotatedDump, workingDump);
            advancedFromAnnotatedDump = true;
        } catch (error) {
            logger.error({
                err: error,
                jobId: payload.jobId,
                analysisId,
                annotatedDump
            }, 'Failed to advance working dump from annotated dump; falling back to merging exposure tables');
        }
    }

    if (!advancedFromAnnotatedDump) {
        const mergedPaths = new Set<string>();
        for (const exposure of exposures) {
            if (!exposure.results.endsWith(ATOMS_PARQUET_SUFFIX)) {
                continue;
            }
            const filePath = createWorkflowExposureOutputFilePath(outputDir, exposure.results);
            if (mergedPaths.has(filePath)) {
                continue;
            }
            try {
                await fs.access(filePath);
                await deps.dumpTransformService.merge(workingDump, filePath);
                mergedPaths.add(filePath);
            } catch (error) {
                logger.error({
                    err: error,
                    jobId: payload.jobId,
                    analysisId,
                    filePath
                }, 'Failed to merge exposure into working dump');
            }
        }
    }

    await persistShared(WORKING_DUMP_EXPOSURE_ID, workingDump);
};

const buildStatusPayload = (
    payload: PipelineQueueJobPayload,
    analysisId: string,
    jobId: string = payload.jobId,
    name?: string
): BaseAnalysisEventData => ({
    jobId,
    name: name ?? payload.name,
    analysisId,
    teamId: payload.teamId,
    trajectoryId: payload.trajectoryId,
    timestep: payload.timestep
});
