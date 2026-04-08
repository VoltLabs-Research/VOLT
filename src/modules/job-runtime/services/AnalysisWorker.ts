import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { forceGC, isMemoryPressured } from '@/core/memory';
import { ANALYSIS_QUEUE_NAME, QueueService } from '@/modules/platform/services';
import { WorkflowNodeType } from '@/modules/workflow-runtime/contracts';
import { createWorkflowNodeRegistry } from '@/modules/workflow-runtime/factories';
import { InlineWorkflowRuntime } from '@/modules/workflow-runtime/services/InlineWorkflowRuntime';
import {
    createInlinePluginReferenceDedupeKey,
    createNestedExecutionResult,
    isInlinePluginReferenceExecutionRequest,
    parseInlineWorkflowArguments,
    readNestedExposureItems,
    resolveInlinePluginExecutionOrder,
    setNestedValueAtPath,
    type InlineExposureArtifact,
    type InlineWorkflowDumpTarget
} from '@/modules/workflow-runtime/services/InlineWorkflowShared';
import { resolveWorkflowTemplate } from '@/modules/workflow-runtime/services/WorkflowOutputResolution';
import { inflateAnalysisExecutionData } from '@/shared/utilities/analysis-execution-data';
import {
    getRecommendedBinaryThreads,
    getSafeAnalysisWorkerConcurrency
} from '@/shared/utilities/analysis-resource-policy';
import { isRecord } from '@/shared/utils';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createZstdDecompressionStream } from '@/shared/utilities/storage-codec';
import { pipeline } from 'node:stream/promises';
import { DelayedError } from 'bullmq';
import type { DaemonJobReporterService } from '@/modules/cloud-control/services';
import type { ArtifactUploadBatch, ArtifactUploadQueueService, ResultProcessorService } from '@/modules/artifacts/services';
import { ObjectBucketName } from '@/shared/contracts';
import type {
    AnalysisJobExecutionData,
    AnalysisQueueJobPayload,
    PluginReferenceExecutionRequest,
    TrajectoryDumpDescriptor
} from '@/shared/contracts';
import type { AnalysisExecutionDataStore } from '@/modules/platform/services';
import type { Job as BullMQJob, Worker } from 'bullmq';
import type { Readable } from 'node:stream';
import type { WorkflowNodeRegistry } from '@/modules/workflow-runtime/services';
import {
    createAnalysisExecutionLogSink,
    type ExecutionLogSegmentMetadata
} from './ExecutionLogStreaming';
import type {
    BinaryExecutorService,
    ProcessExecutionLogSink
} from './BinaryExecutorService';
import type { PluginBinaryCacheService } from './PluginBinaryCacheService';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
const DUMPS_BUCKET = ObjectBucketName.Dumps;
let activeBinaryExecutions = 0;

const logMemoryUsage = (context: string, jobId: string): void => {
    const usage = process.memoryUsage();
    logger.info(
        {
            jobId,
            context,
            heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
            rssMB: Math.round(usage.rss / 1024 / 1024),
            externalMB: Math.round(usage.external / 1024 / 1024)
        },
        'Memory usage'
    );
};

interface QueueJobPayload extends AnalysisQueueJobPayload {
    metadata?: Record<string, unknown>;
    executionData?: AnalysisJobExecutionData;
};

interface WorkflowContextDumpPath {
    timestep: number;
    natoms: number;
    simulationCell: string;
    path: string;
    originalPath?: string;
};

interface TrajectoryFrameMetadata {
    timestep: number;
    natoms: number;
    simulationCell: string;
};

const MAX_INLINE_NESTED_PLUGIN_CONCURRENCY = 2;

const resolveInlineNestedPluginConcurrency = (itemCount: number): number => {
    return Math.max(1, Math.min(MAX_INLINE_NESTED_PLUGIN_CONCURRENCY, itemCount));
};

const runWithConcurrencyLimit = async <TItem, TResult>(
    items: TItem[],
    concurrency: number,
    task: (item: TItem, index: number) => Promise<TResult>
): Promise<TResult[]> => {
    if (items.length === 0) {
        return [];
    }

    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    const results = new Array<TResult>(items.length);
    let nextIndex = 0;

    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (true) {
            const currentIndex = nextIndex;
            nextIndex += 1;

            if (currentIndex >= items.length) {
                return;
            }

            results[currentIndex] = await task(items[currentIndex], currentIndex);
        }
    }));

    return results;
};

const findThreadsArgumentIndex = (args: string[]): number => {
    for (let index = 0; index < args.length - 1; index += 1) {
        if (args[index] !== '--threads') {
            continue;
        }

        const parsedThreads = Number.parseInt(args[index + 1] ?? '', 10);
        if (Number.isFinite(parsedThreads) && parsedThreads >= 1) {
            return index;
        }
    }

    return -1;
};

interface BinaryExecutionLease {
    args: string[];
    requestedThreads?: number;
    appliedThreads?: number;
    activeBinaryExecutions: number;
    release: () => void;
}

const acquireBinaryExecutionLease = (args: string[]): BinaryExecutionLease => {
    activeBinaryExecutions += 1;
    const currentActiveExecutions = activeBinaryExecutions;
    const release = (): void => {
        activeBinaryExecutions = Math.max(0, activeBinaryExecutions - 1);
    };

    const threadsArgumentIndex = findThreadsArgumentIndex(args);
    if (threadsArgumentIndex === -1) {
        return {
            args: [...args],
            activeBinaryExecutions: currentActiveExecutions,
            release
        };
    }

    const requestedThreads = Number.parseInt(args[threadsArgumentIndex + 1] ?? '', 10);
    if (!Number.isFinite(requestedThreads) || requestedThreads < 1) {
        return {
            args: [...args],
            activeBinaryExecutions: currentActiveExecutions,
            release
        };
    }

    const appliedThreads = getRecommendedBinaryThreads(requestedThreads, currentActiveExecutions);
    if (appliedThreads === requestedThreads) {
        return {
            args: [...args],
            requestedThreads,
            appliedThreads,
            activeBinaryExecutions: currentActiveExecutions,
            release
        };
    }

    const adjustedArgs = [...args];
    adjustedArgs[threadsArgumentIndex + 1] = String(appliedThreads);

    return {
        args: adjustedArgs,
        requestedThreads,
        appliedThreads,
        activeBinaryExecutions: currentActiveExecutions,
        release
    };
};

const createRuntimeWorkflowRegistry = (): WorkflowNodeRegistry => {
    return createWorkflowNodeRegistry();
};

const isTrajectoryDumpDescriptor = (value: unknown): value is TrajectoryDumpDescriptor => {
    return isRecord(value)
        && typeof value.path === 'string'
        && typeof value.timestep === 'number'
        && Number.isFinite(value.timestep)
        && typeof value.natoms === 'number'
        && Number.isFinite(value.natoms)
        && typeof value.simulationCell === 'string'
        && (typeof value.originalPath === 'undefined' || typeof value.originalPath === 'string');
};

const readBatchTrajectoryDumps = (executionData: AnalysisJobExecutionData): TrajectoryDumpDescriptor[] => {
    if (!Array.isArray(executionData.batchTrajectoryDumps)) {
        return [];
    }

    return executionData.batchTrajectoryDumps.filter(isTrajectoryDumpDescriptor);
};

const createWorkflowContextDumpPaths = (dumpTargets: InlineWorkflowDumpTarget[]): WorkflowContextDumpPath[] => {
    return dumpTargets.map((dumpTarget) => ({
        timestep: dumpTarget.timestep,
        natoms: dumpTarget.natoms,
        simulationCell: dumpTarget.simulationCell,
        path: dumpTarget.localPath,
        originalPath: dumpTarget.originalPath
    }));
};

const createFrameMetadataByTimestep = (
    frames: TrajectoryFrameMetadata[]
): Map<number, TrajectoryFrameMetadata> => {
    return new Map(frames.map((frame) => [frame.timestep, frame]));
};

const applyBatchContextDumpPaths = (
    contextOutput: Record<string, unknown>,
    dumpTargets: InlineWorkflowDumpTarget[],
    outputDir: string
): Record<string, unknown> => {
    const dumpPaths = createWorkflowContextDumpPaths(dumpTargets);
    const trajectory = isRecord(contextOutput.trajectory)
        ? { ...contextOutput.trajectory }
        : {};

    trajectory.frames = dumpPaths;

    return {
        ...contextOutput,
        trajectory_dumps: dumpPaths,
        trajectory,
        allDumpLocalPaths: JSON.stringify(dumpTargets.map((dumpTarget) => dumpTarget.localPath)),
        outputPath: outputDir
    };
};

export class AnalysisWorker {
    private running = false;
    private worker: Worker<QueueJobPayload> | null = null;
    private readonly workflowNodeRegistry = createRuntimeWorkflowRegistry();
    private readonly inlineWorkflowRuntime: InlineWorkflowRuntime;

    constructor(
        private readonly queueService: QueueService,
        private readonly analysisExecutionDataStore: AnalysisExecutionDataStore,
        private readonly objectStore: ClusterObjectStore,
        private readonly pluginBinaryCacheService: PluginBinaryCacheService,
        private readonly binaryExecutorService: BinaryExecutorService,
        private readonly artifactUploadQueueService: ArtifactUploadQueueService,
        private readonly resultProcessorService: ResultProcessorService,
        private readonly daemonJobReporterService: DaemonJobReporterService
    ) {
        this.inlineWorkflowRuntime = new InlineWorkflowRuntime(
            this.workflowNodeRegistry,
            pluginBinaryCacheService,
            binaryExecutorService
        );
    }

    private createAnalysisLogSink(
        jobId: string,
        executionData: AnalysisJobExecutionData,
        timesteps: number[],
        metadata: ExecutionLogSegmentMetadata
    ): ProcessExecutionLogSink | undefined {
        const teamId = typeof executionData.teamId === 'string'
            ? executionData.teamId.trim()
            : '';
        const trajectoryId = typeof executionData.trajectoryId === 'string'
            ? executionData.trajectoryId.trim()
            : '';
        if (!teamId || !trajectoryId) {
            return undefined;
        }

        return createAnalysisExecutionLogSink({
            reporter: this.daemonJobReporterService,
            jobId,
            analysisId: executionData.analysisId,
            teamId,
            trajectoryId,
            timesteps,
            metadata
        });
    }

    private resolveEntrypointNodeId(workflow: AnalysisJobExecutionData['workflow']): string | null {
        const entrypointNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        return entrypointNode?.id ?? null;
    }

    start(concurrency?: number): void {
        if (this.running) {
            return;
        }

        const requestedConcurrency = concurrency ?? 1;
        const effectiveConcurrency = getSafeAnalysisWorkerConcurrency(requestedConcurrency);
        this.running = true;
        this.worker = this.queueService.createWorker<QueueJobPayload>(
            ANALYSIS_QUEUE_NAME,
            async (jobPayload, job) => this.processJob(jobPayload, job),
            { concurrency: effectiveConcurrency }
        );

        this.worker.on('failed', (job, error) => {
            logger.error(
                {
                    jobId: job?.data?.jobId,
                    err: error
                },
                'BullMQ analysis job failed'
            );
        });

        logger.info(
            {
                requestedConcurrency,
                effectiveConcurrency
            },
            'AnalysisWorker started'
        );
    }

    async stop(): Promise<void> {
        this.running = false;
        if (this.worker) {
            await this.worker.close();
            this.worker = null;
        }

        logger.info('AnalysisWorker stopped');
    }

    setConcurrency(concurrency: number): void {
        if (!this.worker) {
            throw new Error('AnalysisWorker has not started');
        }

        const effectiveConcurrency = getSafeAnalysisWorkerConcurrency(concurrency);
        this.worker.concurrency = effectiveConcurrency;
        logger.info(
            {
                requestedConcurrency: concurrency,
                effectiveConcurrency
            },
            'AnalysisWorker concurrency updated'
        );
    }

    private async processJob(job: QueueJobPayload, bullJob: BullMQJob<QueueJobPayload>): Promise<void> {
        // Memory-aware scheduling: if heap is above 75%, requeue with delay instead of risking OOM
        if (isMemoryPressured()) {
            const delayMs = 30_000;
            logger.warn(
                { jobId: job.jobId, delayMs },
                'Heap memory pressure detected — delaying analysis job'
            );
            await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
            throw new DelayedError();
        }

        const metadata = isRecord(job.metadata) ? job.metadata : {};
        let executionData: AnalysisJobExecutionData | null = null;
        let isBatchMode = false;
        const forEachItem = isRecord(metadata.forEachItem) ? metadata.forEachItem : {};
        const forEachIndex = typeof metadata.forEachIndex === 'number' ? metadata.forEachIndex : 0;
        let timestep: number | undefined;
        let inputFile = '';

        let dumpLocalPath: string | undefined;
        let batchDumpLocalPaths: string[] | undefined;
        let outputDir: string | undefined;
        let artifactUploadBatch: ArtifactUploadBatch | null = null;

        try {
            executionData = await this.resolveExecutionData(job);
            isBatchMode = executionData.batchMode === true;
            timestep = isBatchMode ? 0 : this.resolveJobTimestep(job, metadata);
            inputFile = typeof metadata.inputFile === 'string' ? metadata.inputFile : '';

            if (!isBatchMode && typeof timestep === 'undefined') {
                throw new Error(`Missing timestep for analysis job ${job.jobId}`);
            }

            artifactUploadBatch = this.artifactUploadQueueService.createBatch({
                analysisId: executionData.analysisId,
                analysisJobId: job.jobId,
                teamId: job.teamId,
                trajectoryId: executionData.trajectoryId,
                trajectoryName: typeof metadata.trajectoryName === 'string' ? metadata.trajectoryName : undefined,
                timestep
            });

            // Report running status to the Volt server for real-time client visibility
            void this.daemonJobReporterService.reportAnalysisJobStatus({
                jobId: job.jobId,
                name: job.name,
                analysisId: executionData.analysisId,
                teamId: job.teamId,
                trajectoryId: typeof metadata.trajectoryId === 'string' ? metadata.trajectoryId : undefined,
                trajectoryName: typeof metadata.trajectoryName === 'string' ? metadata.trajectoryName : undefined,
                timestep,
                status: 'running'
            }).catch((err) => {
                logger.warn({ jobId: job.jobId, err }, 'Failed to report running status to server');
            });

            const executionRuntime = await this.pluginBinaryCacheService.getExecutionRuntime({
                binaryObjectPath: executionData.binaryObjectPath,
                entrypointType: executionData.entrypointType,
                requirementsFile: executionData.requirementsFile,
                entrypointScript: executionData.entrypointScript
            });

            const dumpOwnerClusterId = executionData.storageClusterId;
            if (!dumpOwnerClusterId) {
                throw new Error(`Missing storageClusterId for analysis ${executionData.analysisId}`);
            }
            if (isBatchMode && Array.isArray(executionData.allDumpUrls) && executionData.allDumpUrls.length > 0) {
                // Batch mode: download ALL dump files
                batchDumpLocalPaths = [];
                for (const dumpUrl of executionData.allDumpUrls) {
                    const localPath = await this.downloadDump(dumpUrl, dumpOwnerClusterId);
                    batchDumpLocalPaths.push(localPath);
                }
                dumpLocalPath = batchDumpLocalPaths[0];
                logMemoryUsage('after-batch-dump-download', job.jobId);
            } else {
                dumpLocalPath = await this.downloadDump(inputFile, dumpOwnerClusterId);
                logMemoryUsage('after-dump-download', job.jobId);
            }

            outputDir = path.join(DAEMON_PATHS.analysisOutput, `${executionData.analysisId}-${forEachIndex}-${Date.now()}`);
            await fs.mkdir(outputDir, { recursive: true });

            let outputs: Map<string, Record<string, unknown>>;
            if (isBatchMode && batchDumpLocalPaths) {
                outputs = this.buildBatchOutputsMap(executionData, batchDumpLocalPaths, outputDir);
            } else {
                outputs = this.buildOutputsMap(executionData, forEachItem, forEachIndex, dumpLocalPath!, outputDir);
            }

            if (isBatchMode && batchDumpLocalPaths) {
                await this.executeBatchInlinePluginNodes(job.jobId, executionData, outputs, batchDumpLocalPaths, outputDir);
            } else {
                await this.executeInlinePluginNodes(job.jobId, executionData, outputs, timestep!, dumpLocalPath!, outputDir);
            }

            const resolvedArgs = resolveWorkflowTemplate(executionData.arguments, outputs);
            const args = parseInlineWorkflowArguments(resolvedArgs);

            await bullJob.updateProgress(10);
            const binaryStartedAt = Date.now();
            const binaryExecutionLease = acquireBinaryExecutionLease(args);
            if (
                typeof binaryExecutionLease.requestedThreads === 'number'
                && typeof binaryExecutionLease.appliedThreads === 'number'
                && binaryExecutionLease.appliedThreads !== binaryExecutionLease.requestedThreads
            ) {
                logger.info(
                    {
                        jobId: job.jobId,
                        requestedThreads: binaryExecutionLease.requestedThreads,
                        appliedThreads: binaryExecutionLease.appliedThreads,
                        activeBinaryExecutions: binaryExecutionLease.activeBinaryExecutions
                    },
                    'Adjusted plugin binary thread count to fit concurrent cluster load'
                );
            }

            const executionArgs = [...executionRuntime.argsPrefix, ...binaryExecutionLease.args];
            const rootLogTimesteps = isBatchMode
                ? this.createDumpExecutionTargets(executionData, batchDumpLocalPaths ?? []).map((dumpTarget) => dumpTarget.timestep)
                : [timestep!];
            const rootEntrypointNodeId = this.resolveEntrypointNodeId(executionData.workflow) ?? 'entrypoint';
            const rootLogSink = this.createAnalysisLogSink(
                job.jobId,
                executionData,
                rootLogTimesteps,
                {
                    nodeId: rootEntrypointNodeId,
                    nodeType: WorkflowNodeType.Entrypoint,
                    pluginId: executionData.pluginId,
                    executionPath: [rootEntrypointNodeId]
                }
            );
            logger.info(
                {
                    jobId: job.jobId,
                    binary: path.basename(executionRuntime.artifactPath),
                    args: executionArgs,
                    outputDir,
                    entrypointType: executionData.entrypointType ?? 'executable'
                },
                'Executing plugin binary'
            );

            let result: Awaited<ReturnType<BinaryExecutorService['executeProcess']>>;
            try {
                result = await this.binaryExecutorService.executeProcess({
                    jobId: job.jobId,
                    commandPath: executionRuntime.commandPath,
                    args: executionArgs,
                    cwd: outputDir,
                    env: executionRuntime.env,
                    timeoutMs: executionData.timeoutMs,
                    logSink: rootLogSink
                });
            } finally {
                binaryExecutionLease.release();
            }
            if (result.code !== 0) {
                throw new Error(`Binary exited with code ${result.code}: ${result.stderr || result.stdout}`);
            }

            const outputFiles = await fs.readdir(outputDir).catch(() => []);

            logger.info(
                {
                    jobId: job.jobId,
                    exitCode: result.code,
                    durationMs: Date.now() - binaryStartedAt,
                    stdoutPreview: result.stdout.slice(0, 4000),
                    stderrPreview: result.stderr.slice(0, 4000),
                    outputFiles
                },
                'Binary execution completed'
            );
            logMemoryUsage('after-binary-execution', job.jobId);
            await bullJob.updateProgress(70);

            for (const exposure of executionData.exposures) {
                // Memory-aware scheduling between exposures: if heap is above
                // 75 % after a previous exposure, force GC and wait before
                // starting the next one to avoid compounding allocations.
                if (isMemoryPressured()) {
                    logger.warn(
                        { jobId: job.jobId, exposure: exposure.name },
                        'Heap pressure detected between exposures — forcing GC and yielding'
                    );
                    forceGC();
                    // Yield to the event loop so V8 can finish sweeping before
                    // the next heavy allocation.
                    await new Promise((resolve) => setImmediate(resolve));
                }

                const exposureStartedAt = Date.now();
                logger.info(
                    {
                        jobId: job.jobId,
                        exposureName: exposure.name,
                        exposureNodeId: exposure.nodeId,
                        exposureResults: exposure.results,
                        outputDir
                    },
                    'Starting exposure result processing'
                );
                await this.resultProcessorService.processExposureResult(
                    executionData,
                    exposure,
                    outputDir,
                    timestep!,
                    job.teamId,
                    artifactUploadBatch
                );
                logger.info(
                    {
                        jobId: job.jobId,
                        exposureName: exposure.name,
                        exposureNodeId: exposure.nodeId,
                        durationMs: Date.now() - exposureStartedAt
                    },
                    'Completed exposure result processing'
                );

                // Always force GC after each exposure to reclaim decoded
                // msgpack data, typed arrays, and intermediate objects before
                // the next exposure starts.
                forceGC();
            }

            const { jobId: artifactUploadJobId, queuedUploads } = await artifactUploadBatch.enqueue();
            if (artifactUploadJobId) {
                await this.daemonJobReporterService.reportArtifactUploadJobStatus({
                    jobId: artifactUploadJobId,
                    analysisId: executionData.analysisId,
                    teamId: job.teamId,
                    trajectoryId: executionData.trajectoryId,
                    trajectoryName: typeof metadata.trajectoryName === 'string' ? metadata.trajectoryName : undefined,
                    timestep,
                    status: 'queued'
                }).catch((err) => {
                    logger.warn({ err, jobId: artifactUploadJobId }, 'Failed to report queued artifact upload status');
                });
            }

            logger.info(
                {
                    analysisId: executionData.analysisId,
                    artifactUploadJobId,
                    jobId: job.jobId,
                    stagedArtifactCount: queuedUploads,
                    timestep
                },
                'Queued staged analysis artifact uploads'
            );

            logMemoryUsage('after-result-processing', job.jobId);
            await bullJob.updateProgress(95);

            await this.daemonJobReporterService.reportJobCompletion({
                jobId: job.jobId,
                name: job.name,
                analysisId: executionData.analysisId,
                teamId: job.teamId,
                timestep,
                success: true
            });

            logger.info({ jobId: job.jobId }, 'Job completed successfully');
            await bullJob.updateProgress(100);
        } catch (error: unknown) {
            if (error instanceof DelayedError) {
                return;
            }

            const message = error instanceof Error ? error.message : String(error);
            logger.error({ jobId: job.jobId, err: error }, `Job failed: ${message}`);
            const analysisId = executionData?.analysisId
                ?? (typeof metadata.analysisId === 'string' ? metadata.analysisId : 'unknown-analysis');

            await this.daemonJobReporterService.reportJobCompletion({
                jobId: job.jobId,
                name: job.name,
                analysisId,
                teamId: job.teamId,
                timestep,
                success: false,
                error: message
            }).catch(() => {});

            throw error instanceof Error ? error : new Error(message);
        } finally {
            const dumpPathsToClean = batchDumpLocalPaths
                ?? (dumpLocalPath ? [dumpLocalPath] : []);

            if (dumpPathsToClean.length > 0) {
                const cleanupTask = outputDir
                    ? this.cleanupBatch(dumpPathsToClean, outputDir)
                    : this.cleanupDumpPaths(dumpPathsToClean);

                await cleanupTask.catch((err) => {
                    logger.warn({ jobId: job.jobId, err }, 'Post-job cleanup failed');
                });
            }

            if (artifactUploadBatch) {
                await artifactUploadBatch.cleanup().catch((err) => {
                    logger.warn({ jobId: job.jobId, err }, 'Artifact upload batch cleanup failed');
                });
            }
        }
    }

    private resolveJobTimestep(
        job: QueueJobPayload,
        metadata: Record<string, unknown>
    ): number | undefined {
        if (typeof job.timestep === 'number' && Number.isFinite(job.timestep)) {
            return job.timestep;
        }

        if (typeof metadata.timestep === 'number' && Number.isFinite(metadata.timestep)) {
            return metadata.timestep;
        }

        if (typeof metadata.timestep === 'string' && metadata.timestep.trim().length > 0) {
            const parsedTimestep = Number(metadata.timestep);
            if (Number.isFinite(parsedTimestep)) {
                return parsedTimestep;
            }
        }

        return undefined;
    }

    private async resolveExecutionData(job: QueueJobPayload): Promise<AnalysisJobExecutionData> {
        if (job.executionDataReference) {
            const referencedExecutionData = await this.analysisExecutionDataStore.get(job.executionDataReference);
            if (referencedExecutionData) {
                logger.info(
                    {
                        analysisId: referencedExecutionData.analysisId,
                        jobId: job.jobId,
                        referenceKey: job.executionDataReference.key
                    },
                    'Using shared analysis execution data reference'
                );
                return referencedExecutionData;
            }

            if (typeof job.executionDataCompressed === 'string' && job.executionDataCompressed.length > 0) {
                try {
                    const parsedExecutionData = inflateAnalysisExecutionData(job.executionDataCompressed);

                    logger.warn(
                        {
                            analysisId: parsedExecutionData.analysisId,
                            jobId: job.jobId,
                            referenceKey: job.executionDataReference.key
                        },
                        'Falling back to compressed analysis execution data after reference resolution miss'
                    );
                    return parsedExecutionData;
                } catch (error: unknown) {
                    logger.warn(
                        {
                            err: error,
                            jobId: job.jobId,
                            referenceKey: job.executionDataReference.key
                        },
                        'Failed to inflate compressed analysis execution data fallback'
                    );
                }
            }

            if (job.executionData) {
                logger.warn(
                    {
                        jobId: job.jobId,
                        referenceKey: job.executionDataReference.key
                    },
                    'Falling back to inline analysis execution data after reference resolution miss'
                );
                return job.executionData;
            }
        }

        if (job.executionData) {
            logger.info(
                {
                    analysisId: job.executionData.analysisId,
                    jobId: job.jobId
                },
                'Using inline analysis execution data payload'
            );
            return job.executionData;
        }

        throw new Error(`Missing analysis execution data for job ${job.jobId}`);
    }

    private buildOutputsMap(
        executionData: AnalysisJobExecutionData,
        forEachItem: Record<string, unknown>,
        forEachIndex: number,
        dumpLocalPath: string,
        outputDir: string
    ): Map<string, Record<string, unknown>> {
        const outputs = new Map<string, Record<string, unknown>>();

        for (const [nodeId, nodeOutput] of Object.entries(executionData.nodeOutputSnapshots)) {
            outputs.set(nodeId, { ...nodeOutput });
        }

        if (executionData.forEachNodeId) {
            const forEachOutput = outputs.get(executionData.forEachNodeId) || {};
            forEachOutput.currentValue = {
                ...forEachItem,
                path: dumpLocalPath
            };
            forEachOutput.currentIndex = forEachIndex;
            forEachOutput.outputPath = outputDir;
            outputs.set(executionData.forEachNodeId, forEachOutput);
        }

        return outputs;
    }

    private buildBatchOutputsMap(
        executionData: AnalysisJobExecutionData,
        allDumpLocalPaths: string[],
        outputDir: string
    ): Map<string, Record<string, unknown>> {
        const outputs = new Map<string, Record<string, unknown>>();
        const dumpTargets = this.createDumpExecutionTargets(executionData, allDumpLocalPaths);

        for (const [nodeId, nodeOutput] of Object.entries(executionData.nodeOutputSnapshots)) {
            outputs.set(nodeId, { ...nodeOutput });
        }

        const contextNodeId = executionData.contextNodeId;
        if (contextNodeId) {
            const contextOutput = outputs.get(contextNodeId) || {};
            outputs.set(contextNodeId, applyBatchContextDumpPaths(contextOutput, dumpTargets, outputDir));
        }

        return outputs;
    }

    private async executeInlinePluginNodes(
        jobId: string,
        executionData: AnalysisJobExecutionData,
        outputs: Map<string, Record<string, unknown>>,
        timestep: number,
        dumpLocalPath: string,
        outputDir: string
    ): Promise<void> {
        const dumpTarget = this.createDumpExecutionTargets(executionData, [dumpLocalPath], timestep)[0];
        if (!dumpTarget) {
            return;
        }

        await this.executeArgumentPluginReferences(jobId, executionData, outputs, [dumpTarget], outputDir);

        const pluginNodes = resolveInlinePluginExecutionOrder(executionData.workflow);
        if (!pluginNodes.length) {
            return;
        }

        for (const pluginNode of pluginNodes) {
            const execution = await this.inlineWorkflowRuntime.executePluginNode({
                node: pluginNode,
                nestedPlugins: executionData.nestedPlugins,
                outputs,
                dumpTarget,
                outputDir,
                trajectoryId: executionData.trajectoryId,
                analysisId: executionData.analysisId,
                teamId: executionData.teamId ?? '',
                rootNodeId: pluginNode.id,
                executionPath: [pluginNode.id],
                logSinkFactory: (context) => this.createAnalysisLogSink(
                    jobId,
                    executionData,
                    [dumpTarget.timestep],
                    {
                        nodeId: context.nodeId,
                        nodeType: context.nodeType,
                        pluginId: context.pluginId,
                        executionPath: context.executionPath
                    }
                )
            });
            outputs.set(pluginNode.id, execution.output);
        }
    }

    private async executeBatchInlinePluginNodes(
        jobId: string,
        executionData: AnalysisJobExecutionData,
        outputs: Map<string, Record<string, unknown>>,
        dumpLocalPaths: string[],
        outputDir: string
    ): Promise<void> {
        const dumpTargets = this.createDumpExecutionTargets(executionData, dumpLocalPaths);
        if (dumpTargets.length > 0) {
            await this.executeArgumentPluginReferences(jobId, executionData, outputs, dumpTargets, outputDir);
        }

        const pluginNodes = resolveInlinePluginExecutionOrder(executionData.workflow);
        if (!pluginNodes.length) {
            return;
        }

        if (!dumpTargets.length) {
            return;
        }

        const perDumpOutputs = dumpTargets.map(() => {
            const clonedOutputs = new Map<string, Record<string, unknown>>();
            for (const [nodeId, nodeOutput] of outputs.entries()) {
                clonedOutputs.set(nodeId, { ...nodeOutput });
            }
            return clonedOutputs;
        });

        for (const pluginNode of pluginNodes) {
            const aggregatedArtifacts: InlineExposureArtifact[] = [];
            const artifactGroups = await runWithConcurrencyLimit(
                dumpTargets,
                resolveInlineNestedPluginConcurrency(dumpTargets.length),
                async (dumpTarget, index) => {
                    const dumpOutputs = perDumpOutputs[index];

                    const execution = await this.inlineWorkflowRuntime.executePluginNode({
                        node: pluginNode,
                        nestedPlugins: executionData.nestedPlugins,
                        outputs: dumpOutputs,
                        dumpTarget,
                        outputDir: `${outputDir}_batch_${index}`,
                        trajectoryId: executionData.trajectoryId,
                        analysisId: executionData.analysisId,
                        teamId: executionData.teamId ?? '',
                        rootNodeId: pluginNode.id,
                        executionPath: [pluginNode.id],
                        logSinkFactory: (context) => this.createAnalysisLogSink(
                            jobId,
                            executionData,
                            [dumpTarget.timestep],
                            {
                                nodeId: context.nodeId,
                                nodeType: context.nodeType,
                                pluginId: context.pluginId,
                                executionPath: context.executionPath
                            }
                        )
                    });

                    dumpOutputs.set(pluginNode.id, execution.output);
                    return readNestedExposureItems(execution.output);
                }
            );

            for (const artifacts of artifactGroups) {
                aggregatedArtifacts.push(...artifacts);
            }

            outputs.set(pluginNode.id, createNestedExecutionResult(aggregatedArtifacts));
        }
    }

    private async executeArgumentPluginReferences(
        jobId: string,
        executionData: AnalysisJobExecutionData,
        outputs: Map<string, Record<string, unknown>>,
        dumpTargets: InlineWorkflowDumpTarget[],
        outputDir: string
    ): Promise<void> {
        const requests = Array.isArray(executionData.pluginReferenceExecutions)
            ? executionData.pluginReferenceExecutions.filter(isInlinePluginReferenceExecutionRequest)
            : [];
        if (!requests.length || !dumpTargets.length) {
            return;
        }

        const argumentsNode = executionData.workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
        if (!argumentsNode) {
            return;
        }

        const dedupedRequests = new Map<string, PluginReferenceExecutionRequest>();
        for (const request of requests) {
            const dedupeKey = createInlinePluginReferenceDedupeKey(request);
            if (!dedupedRequests.has(dedupeKey)) {
                dedupedRequests.set(dedupeKey, request);
            }
        }

        const dedupedResults = new Map<string, Record<string, unknown>>();

        for (const [dedupeKey, request] of dedupedRequests.entries()) {
            const aggregatedArtifacts: InlineExposureArtifact[] = [];
            const artifactGroups = await runWithConcurrencyLimit(
                dumpTargets,
                resolveInlineNestedPluginConcurrency(dumpTargets.length),
                async (dumpTarget, index) => {
                    const execution = await this.inlineWorkflowRuntime.executePluginReference({
                        request,
                        nestedPlugins: executionData.nestedPlugins,
                        outputs,
                        dumpTarget,
                        outputDir: `${outputDir}_plugin_reference_${index}`,
                        trajectoryId: executionData.trajectoryId,
                        analysisId: executionData.analysisId,
                        teamId: executionData.teamId ?? '',
                        rootNodeId: argumentsNode.id,
                        executionPath: [argumentsNode.id, request.referencePath],
                        logSinkFactory: (context) => this.createAnalysisLogSink(
                            jobId,
                            executionData,
                            [dumpTarget.timestep],
                            {
                                nodeId: context.nodeId,
                                nodeType: context.nodeType,
                                pluginId: context.pluginId,
                                executionPath: context.executionPath
                            }
                        )
                    });

                    return readNestedExposureItems(execution.output);
                }
            );

            for (const artifacts of artifactGroups) {
                aggregatedArtifacts.push(...artifacts);
            }

            dedupedResults.set(dedupeKey, createNestedExecutionResult(aggregatedArtifacts));
        }

        const argumentsOutput = { ...(outputs.get(argumentsNode.id) ?? {}) };
        const executionResultsObject: Record<string, unknown> = {};

        for (const request of requests) {
            const dedupeKey = createInlinePluginReferenceDedupeKey(request);
            const dedupedResult = dedupedResults.get(dedupeKey) ?? createNestedExecutionResult([]);
            const executionResult = dedupedResult.execution_result;

            executionResultsObject[request.referencePath] = executionResult;
            setNestedValueAtPath(argumentsOutput, request.referencePath, {
                pluginId: request.pluginId,
                config: request.config,
                execution_result: executionResult
            });
        }

        argumentsOutput.pluginReferences = {
            execution_results: executionResultsObject,
            execution_results_str_json: JSON.stringify(executionResultsObject)
        };
        outputs.set(argumentsNode.id, argumentsOutput);
    }

    private createDumpExecutionTargets(
        executionData: AnalysisJobExecutionData,
        dumpLocalPaths: string[],
        fallbackTimestep?: number
    ): InlineWorkflowDumpTarget[] {
        const batchTrajectoryDumps = readBatchTrajectoryDumps(executionData);
        const batchDumpMetadataByPath = new Map(
            batchTrajectoryDumps.map((dump) => [dump.path, dump])
        );
        const frameMetadataByTimestep = createFrameMetadataByTimestep(executionData.trajectoryFrames);

        return dumpLocalPaths.map((localPath, index) => {
            const batchDumpMetadata = batchTrajectoryDumps[index]
                ?? batchDumpMetadataByPath.get(executionData.allDumpUrls?.[index] ?? '');
            const originalPath = batchDumpMetadata?.originalPath ?? batchDumpMetadata?.path ?? executionData.allDumpUrls?.[index];
            const timestep = batchDumpMetadata?.timestep ?? fallbackTimestep ?? 0;
            const frameMetadata = frameMetadataByTimestep.get(timestep);

            return {
                localPath,
                originalPath,
                timestep,
                natoms: batchDumpMetadata?.natoms ?? frameMetadata?.natoms ?? 0,
                simulationCell: batchDumpMetadata?.simulationCell ?? frameMetadata?.simulationCell ?? ''
            };
        });
    }

    private async downloadDump(objectKey: string, ownerClusterId?: string): Promise<string> {
        if (!objectKey) {
            throw new Error('No dump file path specified in job metadata');
        }

        const normalizedObjectKey = objectKey.startsWith('/')
            ? objectKey.slice(1)
            : objectKey;

        if (!normalizedObjectKey.endsWith('.dump.zst')) {
            throw new Error(`Invalid dump object key received: ${objectKey}`);
        }

        const fileName = path.basename(normalizedObjectKey);
        const localFileName = fileName.slice(0, -4);
        const localPath = path.join(DAEMON_PATHS.analysisDumps, `${localFileName}-${Date.now()}`);
        await fs.mkdir(path.dirname(localPath), { recursive: true });

        const resolvedOwnerClusterId = ownerClusterId || '';
        if (!resolvedOwnerClusterId) {
            throw new Error(`No storage owner cluster available for dump ${normalizedObjectKey}`);
        }

        const response = await this.objectStore.getStream(
            resolvedOwnerClusterId,
            DUMPS_BUCKET,
            normalizedObjectKey,
            {
                skipMetadata: true
            }
        );
        await this.writeStreamToFile(response.stream, localPath);

        logger.info(`Dump downloaded: ${normalizedObjectKey} -> ${localPath}`);
        return localPath;
    }

    private async cleanup(dumpPath: string, outputDir: string): Promise<void> {
        const tasks = [
            fs.rm(dumpPath, { force: true }).catch(() => {}),
            fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
        ];

        try {
            const parentDir = path.dirname(outputDir);
            const baseName = path.basename(outputDir);
            const entries = await fs.readdir(parentDir);
            for (const entry of entries) {
                if (entry.startsWith(`${baseName}_`)) {
                    tasks.push(fs.rm(path.join(parentDir, entry), { recursive: true, force: true }).catch(() => {}));
                }
            }
        } catch {
        }

        await Promise.all(tasks);
    }

    private async cleanupBatch(dumpPaths: string[], outputDir: string): Promise<void> {
        const tasks = [
            ...dumpPaths.map((dumpPath) => fs.rm(dumpPath, { force: true }).catch(() => {})),
            fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
        ];

        try {
            const parentDir = path.dirname(outputDir);
            const baseName = path.basename(outputDir);
            const entries = await fs.readdir(parentDir);
            for (const entry of entries) {
                if (entry.startsWith(`${baseName}_`)) {
                    tasks.push(fs.rm(path.join(parentDir, entry), { recursive: true, force: true }).catch(() => {}));
                }
            }
        } catch {
        }

        await Promise.all(tasks);
    }

    private async cleanupDumpPaths(dumpPaths: string[]): Promise<void> {
        await Promise.all(dumpPaths.map((dumpPath) => fs.rm(dumpPath, { force: true }).catch(() => {})));
    }

    private async writeStreamToFile(stream: Readable, filePath: string): Promise<void> {
        const decompressed = createZstdDecompressionStream(stream);
        await pipeline(decompressed.stream, createWriteStream(filePath));
        await decompressed.completion;
    }
};
