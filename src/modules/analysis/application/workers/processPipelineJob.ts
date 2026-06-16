import path from 'node:path';
import fs from 'node:fs/promises';
import { dir as createTempDir } from 'tmp-promise';

import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { createAnalysisExecutionLogSink } from '@/core/runtime/infrastructure/execution-log-streaming';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { logAndSwallow } from '@/support/error/errorMessage';
import { safeRemovePath } from '@/support/fs/safe-remove-path';
import { downloadCompressedDump } from '@/modules/analysis/application/workflow/dump-download';
import { AnalysisEnvironment } from '@/modules/analysis/application/workflow/AnalysisEnvironment';
import { createAnalysisStageReporter } from '@/modules/analysis/application/workflow/AnalysisStageReporter';
import type { WorkflowRuntime } from '@/modules/analysis/application/workflow/WorkflowRuntime';
import { createWorkflowExposureOutputFilePath } from '@/modules/analysis/application/workflow/exposure-payload-reader';
import {
    createPipelineContext,
    registerSharedExposure,
    resolveSharedExposure,
    type PipelineContext
} from '@/modules/analysis/application/analysis/pipeline-context';
import type { DumpTransformService } from '@/modules/analysis/application/analysis/dump-transform';
import type { PipelineSharedExposureStore } from '@/modules/analysis/application/analysis/PipelineSharedExposureStore';
import type {
    AnalysisExposureDefinition,
    AnalysisJobExecutionData,
    AnalysisJobMetadata,
    AnalysisValueMap,
    PipelinePlannedStage,
    PipelineQueueJobPayload
} from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';
import type { ArtifactUploadQueue } from '@/modules/plugin/application/artifacts/ArtifactUploadQueue';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events';

export interface ProcessPipelineJobDependencies {
    analysisDataStore: AnalysisDataStore;
    analysisEnvironment: AnalysisEnvironment;
    artifactUploadQueue: ArtifactUploadQueue;
    daemonJobReporter: DaemonJobReporter;
    workflowRuntime: WorkflowRuntime;
    dumpTransformService: DumpTransformService;
    pipelineSharedExposureStore: PipelineSharedExposureStore;
    objectStore: ClusterObjectStore;
}

export interface ProcessPipelineJobHooks {
    updateProgress?: (value: number) => Promise<void> | void;
}

const ATOMS_PARQUET_SUFFIX = 'atoms.parquet';

const WORKING_DUMP_EXPOSURE_ID = '__working_dump__';

export const processPipelineJob = async (
    payload: PipelineQueueJobPayload,
    deps: ProcessPipelineJobDependencies,
    hooks: ProcessPipelineJobHooks = {}
): Promise<void> => {
    const { timestep } = payload;
    const storageClusterId = payload.storageClusterId;
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
    const context = createPipelineContext(pipelineTempPath);

    const reportedAnalysisIds = new Set<string>();
    const computeAnalysisIds = payload.stages
        .filter((stage): stage is PipelinePlannedStage & { analysisId: string } =>
            stage.kind === 'plugin' && !stage.cacheHit && typeof stage.analysisId === 'string')
        .map((stage) => stage.analysisId);

    const setProgress = async (value: number): Promise<void> => {
        if (!hooks.updateProgress) return;
        try {
            await hooks.updateProgress(value);
        } catch (error) {
            logger.warn({ err: error, jobId: payload.jobId }, 'processPipelineJob progress callback failed');
        }
    };

    try {
        const downloadedDump = await downloadCompressedDump(
            deps.objectStore,
            `trajectory-${payload.trajectoryId}/timestep-${timestep}.dump.zst`,
            storageClusterId,
            DAEMON_PATHS.analysisDumps
        );
        const workingDump = path.join(pipelineTempPath, 'working.dump');
        await fs.copyFile(downloadedDump, workingDump);
        await safeRemovePath(downloadedDump);
        await setProgress(10);

        for (let index = 0; index < payload.stages.length; index += 1) {
            const stage = payload.stages[index]!;
            const stageDir = path.join(pipelineTempPath, `stage-${index}`);

            switch (stage.kind) {
                case 'slice':
                    await deps.dumpTransformService.slice(workingDump, stage.config ?? {});
                    break;
                case 'expression':
                    await deps.dumpTransformService.select(workingDump, readExpression(stage.config));
                    break;
                case 'plugin':
                    if (stage.cacheHit) {
                        await runCacheHitStage(payload, deps, context, stage, index, storageClusterId, workingDump, stageDir);
                    } else {
                        await runComputeStage(payload, deps, context, stage, workingDump, stageDir, reportedAnalysisIds);
                    }
                    break;
            }
        }

        await setProgress(95);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Pipeline stage failed';
        for (const analysisId of computeAnalysisIds) {
            if (reportedAnalysisIds.has(analysisId)) continue;
            await deps.daemonJobReporter.reportAnalysisFailed({
                jobId: `${payload.jobId}:${analysisId}`,
                name: payload.name,
                analysisId,
                teamId: payload.teamId,
                trajectoryId: payload.trajectoryId,
                timestep,
                error: message
            }).catch(logAndSwallow('warn', { jobId: payload.jobId, analysisId }, 'Failed to report pipeline stage failure'));
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

const runCacheHitStage = async (
    payload: PipelineQueueJobPayload,
    deps: ProcessPipelineJobDependencies,
    context: PipelineContext,
    stage: PipelinePlannedStage,
    stageIndex: number,
    storageClusterId: string,
    workingDump: string,
    stageDir: string
): Promise<void> => {
    const sourceAnalysisId = stage.cacheSourceAnalysisId;
    if (!sourceAnalysisId) {
        throw new Error('Pipeline cache-hit stage is missing cacheSourceAnalysisId');
    }

    await fs.mkdir(stageDir, { recursive: true });
    const stageReporter = createAnalysisStageReporter(
        deps.daemonJobReporter,
        buildStatusPayload(payload, sourceAnalysisId)
    );

    for (const exposureId of stage.sharedExposureIds ?? []) {
        const localPath = await deps.pipelineSharedExposureStore.fetch({
            ownerClusterId: storageClusterId,
            trajectoryId: payload.trajectoryId,
            analysisId: sourceAnalysisId,
            exposureId,
            timestep: payload.timestep,
            destinationDir: stageDir
        });
        if (!localPath) {
            throw new Error(
                `Pipeline cache hit for analysis ${sourceAnalysisId} has no persisted shared exposure "${exposureId}" at timestep ${payload.timestep}`
            );
        }
        registerSharedExposure(context, exposureId, localPath);
    }

    const restoredDump = await deps.pipelineSharedExposureStore.fetch({
        ownerClusterId: storageClusterId,
        trajectoryId: payload.trajectoryId,
        analysisId: sourceAnalysisId,
        exposureId: WORKING_DUMP_EXPOSURE_ID,
        timestep: payload.timestep,
        destinationDir: stageDir
    });
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

    await stageReporter.report({
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
    payload: PipelineQueueJobPayload,
    deps: ProcessPipelineJobDependencies,
    context: PipelineContext,
    stage: PipelinePlannedStage,
    workingDump: string,
    stageDir: string,
    reportedAnalysisIds: Set<string>
): Promise<void> => {
    if (!stage.executionDataReference || !stage.analysisId) {
        throw new Error('Pipeline compute stage is missing its executionData reference');
    }
    const analysisId = stage.analysisId;

    const executionData = await deps.analysisDataStore.get(stage.executionDataReference, payload.jobId);
    const storageClusterId = executionData.identity.storageClusterId;
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

    const metadata: AnalysisJobMetadata = {
        trajectoryId: payload.trajectoryId,
        analysisId,
        name: statusPayload.name,
        config: {},
        plugin: executionData.identity.pluginId,
        totalItems: 1,
        timestep: payload.timestep,
        forEachItem: { timestep: payload.timestep },
        forEachIndex: 0
    };

    await withJobLifecycle(
        {
            reportStatus: (status, error) => {
                if (status === 'started') return;
                if (status === 'failed') {
                    logger.error(`Pipeline compute stage failed for jobId=${stageJobId}: ${error ?? 'Unknown error'}`);
                }
                reportedAnalysisIds.add(analysisId);
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
                workingDump,
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

            await registerStageExposures(deps, context, executionData, analysisId, runtime.outputDir, payload.timestep, storageClusterId, workingDump);

            await artifactUploadBatch.enqueue();
        }
    );
};

const ANNOTATED_DUMP_SUFFIX = 'annotated.dump';

const registerStageExposures = async (
    deps: ProcessPipelineJobDependencies,
    context: PipelineContext,
    executionData: AnalysisJobExecutionData,
    analysisId: string,
    outputDir: string,
    timestep: number,
    storageClusterId: string | undefined,
    workingDump: string
): Promise<void> => {
    for (const exposure of executionData.workflow.exposures) {
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

        if (storageClusterId) {
            await deps.pipelineSharedExposureStore.persist({
                ownerClusterId: storageClusterId,
                trajectoryId: executionData.identity.trajectoryId,
                analysisId,
                exposureId: exposure.id,
                timestep,
                sourcePath: filePath
            });
        }
    }

    const annotatedDump = `${outputDir}_${ANNOTATED_DUMP_SUFFIX}`;
    let advancedFromAnnotatedDump = false;
    try {
        await fs.access(annotatedDump);
        await fs.copyFile(annotatedDump, workingDump);
        advancedFromAnnotatedDump = true;
    } catch {
    }

    if (!advancedFromAnnotatedDump) {
        const mergedPaths = new Set<string>();
        for (const exposure of executionData.workflow.exposures) {
            if (!isPerAtomPropertiesExposure(exposure)) {
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
            } catch {
            }
        }
    }

    if (storageClusterId) {
        await deps.pipelineSharedExposureStore.persist({
            ownerClusterId: storageClusterId,
            trajectoryId: executionData.identity.trajectoryId,
            analysisId,
            exposureId: WORKING_DUMP_EXPOSURE_ID,
            timestep,
            sourcePath: workingDump
        });
    }
};

const isPerAtomPropertiesExposure = (exposure: AnalysisExposureDefinition): boolean =>
    typeof exposure.results === 'string' && exposure.results.endsWith(ATOMS_PARQUET_SUFFIX);

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
