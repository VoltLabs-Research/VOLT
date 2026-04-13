import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { forceGC, isMemoryPressured } from '@/core/memory';
import { ANALYSIS_QUEUE_NAME, QueueService } from '@/modules/platform/services';
import {
    delayJobOnQueueScopeContention,
    tryAcquireQueueScopeLease
} from '@/modules/platform/services';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/workflow-runtime/contracts';
import { createWorkflowNodeRegistry } from '@/modules/workflow-runtime/factories';
import { createWorkflowExecutionContext } from '@/modules/workflow-runtime/services/WorkflowExecutionContextFactory';
import { InlineWorkflowRuntime } from '@/modules/workflow-runtime/services/InlineWorkflowRuntime';
import {
    createNestedExecutionResult,
    parseInlineWorkflowArguments,
    readNestedExposureItems
} from '@/modules/workflow-runtime/services/InlineWorkflowShared';
import { resolveWorkflowTemplate } from '@/modules/workflow-runtime/services/WorkflowOutputResolution';
import { inflateAnalysisExecutionData } from '@/shared/utilities/analysis-execution-data';
import type { QueueScopeLease, QueueScopeLimitsRegistry } from '@/modules/platform/services';
import type { WorkflowNode } from '@/modules/workflow-runtime/contracts';
import type { InlineExposureArtifact, InlineWorkflowDumpTarget } from '@/modules/workflow-runtime/services/InlineWorkflowShared';
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
import { EntrypointType, ObjectBucketName } from '@/shared/contracts';
import type {
    AnalysisJobExecutionData,
    AnalysisQueueJobPayload,
    TrajectoryDumpDescriptor
} from '@/shared/contracts';
import type { AnalysisExecutionDataStore } from '@/modules/platform/services';
import type { RedisConnectionService } from '@/modules/platform/services';
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

const getWorkflowChildren = (
    workflow: WorkflowGraph,
    nodeId: string,
    sourceHandle?: string
): WorkflowNode[] => {
    return workflow.edges
        .filter((edge) => edge.source === nodeId && (typeof sourceHandle === 'undefined' || edge.sourceHandle === sourceHandle))
        .map((edge) => workflow.nodes.find((candidate) => candidate.id === edge.target))
        .filter((candidate): candidate is WorkflowNode => Boolean(candidate));
};

const resolveRuntimeRootNodes = (
    workflow: WorkflowGraph
): WorkflowNode[] => {
    const runtimeRootNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.ForEach)
        ?? workflow.nodes.find((node) => node.type === WorkflowNodeType.Context)
        ?? workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments)
        ?? workflow.nodes.find((node) => node.type === WorkflowNodeType.Modifier)
        ?? null;
    if (!runtimeRootNode) {
        return [];
    }

    return getWorkflowChildren(workflow, runtimeRootNode.id);
};

const matchesIfBranchHandle = (
    edgeHandle: string | undefined,
    selectedBranch: string
): boolean => {
    if (selectedBranch === 'true') {
        return edgeHandle === 'output-true' || edgeHandle === 'true';
    }

    return edgeHandle === 'output-false' || edgeHandle === 'false';
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
        private readonly redisConnectionService: RedisConnectionService,
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
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
        let queueScopeLease: QueueScopeLease | null = null;

        try {
            executionData = await this.resolveExecutionData(job);
            const trajectoryId = executionData.trajectoryId.trim();
            if (!trajectoryId) {
                throw new Error(`Missing trajectoryId for analysis ${executionData.analysisId}`);
            }

            const queueScopeLimits = this.queueScopeLimitsRegistry.getSnapshot();
            const { lease, blockingScope } = await tryAcquireQueueScopeLease(
                this.redisConnectionService,
                ANALYSIS_QUEUE_NAME,
                [
                    {
                        scope: 'trajectory',
                        scopeId: trajectoryId,
                        limit: queueScopeLimits.analysisProcessing.maxRunningPerTrajectory
                    },
                    {
                        scope: 'team',
                        scopeId: executionData.teamId ?? '',
                        limit: queueScopeLimits.analysisProcessing.maxRunningPerTeam
                    }
                ]
            );
            queueScopeLease = lease;
            if (!queueScopeLease || blockingScope) {
                await delayJobOnQueueScopeContention(bullJob, {
                    queueName: ANALYSIS_QUEUE_NAME,
                    jobId: job.jobId,
                    scope: blockingScope ?? {
                        scope: 'trajectory',
                        scopeId: trajectoryId,
                        limit: queueScopeLimits.analysisProcessing.maxRunningPerTrajectory
                    }
                });
            }

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
            this.daemonJobReporterService.reportAnalysisJobStatus({
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
            await bullJob.updateProgress(10);
            const dumpTargets = isBatchMode && batchDumpLocalPaths
                ? this.createDumpExecutionTargets(executionData, batchDumpLocalPaths)
                : this.createDumpExecutionTargets(executionData, [dumpLocalPath!], timestep!);
            await this.executeRuntimeWorkflow({
                jobId: job.jobId,
                executionData,
                outputs,
                dumpTargets,
                outputDir,
                timestep: timestep!,
                artifactUploadBatch,
                isBatchMode
            });
            logMemoryUsage('after-runtime-execution', job.jobId);
            await bullJob.updateProgress(70);

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
                throw error;
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

            if (queueScopeLease) {
                await queueScopeLease.release();
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

    private async executeRuntimeWorkflow(params: {
        jobId: string;
        executionData: AnalysisJobExecutionData;
        outputs: Map<string, Record<string, unknown>>;
        dumpTargets: InlineWorkflowDumpTarget[];
        outputDir: string;
        timestep: number;
        artifactUploadBatch: ArtifactUploadBatch;
        isBatchMode: boolean;
    }): Promise<void> {
        const workflow = new WorkflowGraph(params.executionData.workflow);
        const runtimeContext = createWorkflowExecutionContext({
            outputs: params.outputs,
            userConfig: {},
            runtimeArguments: {},
            trajectoryId: params.executionData.trajectoryId,
            trajectoryFrames: params.executionData.trajectoryFrames,
            analysis: {
                _id: params.executionData.analysisId,
                pluginDisplayName: params.executionData.pluginId
            },
            analysisId: params.executionData.analysisId,
            pluginId: params.executionData.pluginId,
            teamId: params.executionData.teamId ?? '',
            selectedTimestep: params.dumpTargets[0]?.timestep,
            workflow,
            nestedPlugins: params.executionData.nestedPlugins
        });
        const rootNodes = resolveRuntimeRootNodes(workflow).length > 0
            ? resolveRuntimeRootNodes(workflow)
            : workflow.nodes.filter((node) => node.type === WorkflowNodeType.Entrypoint);
        const visitedNodeIds = new Set<string>();

        for (const rootNode of rootNodes) {
            await this.executeRuntimeNode({
                ...params,
                workflow,
                runtimeContext,
                node: rootNode,
                visitedNodeIds,
                executionPath: [rootNode.id]
            });
        }
    }

    private async executeRuntimeNode(params: {
        jobId: string;
        executionData: AnalysisJobExecutionData;
        workflow: WorkflowGraph;
        runtimeContext: ReturnType<typeof createWorkflowExecutionContext>;
        outputs: Map<string, Record<string, unknown>>;
        node: WorkflowNode;
        dumpTargets: InlineWorkflowDumpTarget[];
        outputDir: string;
        timestep: number;
        artifactUploadBatch: ArtifactUploadBatch;
        isBatchMode: boolean;
        visitedNodeIds: Set<string>;
        executionPath: string[];
    }): Promise<void> {
        if (params.visitedNodeIds.has(params.node.id)) {
            return;
        }

        params.visitedNodeIds.add(params.node.id);

        if (params.node.type === WorkflowNodeType.Export) {
            params.outputs.set(params.node.id, {
                processed: false,
                skipped: true,
                reason: 'Export nodes are processed from their linked exposure'
            });
            return;
        }

        if (params.node.type === WorkflowNodeType.Exposure) {
            await this.executeExposureNodeForRuntime(params);
            for (const childNode of getWorkflowChildren(params.workflow, params.node.id)) {
                await this.executeRuntimeNode({
                    ...params,
                    node: childNode,
                    executionPath: [...params.executionPath, childNode.id]
                });
            }
            return;
        }

        if (params.node.type === WorkflowNodeType.Plugin) {
            const pluginOutput = await this.executePluginNodeForRuntime(params);
            params.outputs.set(params.node.id, pluginOutput);
            for (const childNode of getWorkflowChildren(params.workflow, params.node.id)) {
                await this.executeRuntimeNode({
                    ...params,
                    node: childNode,
                    executionPath: [...params.executionPath, childNode.id]
                });
            }
            return;
        }

        if (params.node.type === WorkflowNodeType.Entrypoint) {
            const entrypointOutput = await this.executeEntrypointNodeForRuntime(params);
            params.outputs.set(params.node.id, entrypointOutput);
            for (const childNode of getWorkflowChildren(params.workflow, params.node.id)) {
                await this.executeRuntimeNode({
                    ...params,
                    node: childNode,
                    executionPath: [...params.executionPath, childNode.id]
                });
            }
            return;
        }

        if (!this.workflowNodeRegistry.has(params.node.type)) {
            return;
        }

        const output = await this.workflowNodeRegistry.execute(params.node, params.runtimeContext);
        params.outputs.set(params.node.id, output);

        if (params.node.type === WorkflowNodeType.IfStatement) {
            const branch = output.branch === 'false' ? 'false' : 'true';
            const childNodes = getWorkflowChildren(params.workflow, params.node.id)
                .filter((childNode) => {
                    const edge = params.workflow.edges.find((candidate) => {
                        return candidate.source === params.node.id && candidate.target === childNode.id;
                    });
                    return matchesIfBranchHandle(edge?.sourceHandle, branch);
                });

            for (const childNode of childNodes) {
                await this.executeRuntimeNode({
                    ...params,
                    node: childNode,
                    executionPath: [...params.executionPath, childNode.id]
                });
            }
            return;
        }

        if (params.node.type === WorkflowNodeType.SwitchStatement) {
            const matchedCaseId = typeof output.matchedCaseId === 'string' && output.matchedCaseId.length > 0
                ? output.matchedCaseId
                : null;
            if (matchedCaseId) {
                const matchedCaseNode = params.workflow.nodes.find((candidate) => candidate.id === matchedCaseId);
                if (matchedCaseNode) {
                    await this.executeRuntimeNode({
                        ...params,
                        node: matchedCaseNode,
                        executionPath: [...params.executionPath, matchedCaseNode.id]
                    });
                }
            }

            for (const childNode of getWorkflowChildren(params.workflow, params.node.id, 'continue')) {
                await this.executeRuntimeNode({
                    ...params,
                    node: childNode,
                    executionPath: [...params.executionPath, childNode.id]
                });
            }
            return;
        }

        for (const childNode of getWorkflowChildren(params.workflow, params.node.id)) {
            await this.executeRuntimeNode({
                ...params,
                node: childNode,
                executionPath: [...params.executionPath, childNode.id]
            });
        }
    }

    private async executePluginNodeForRuntime(params: {
        jobId: string;
        executionData: AnalysisJobExecutionData;
        node: WorkflowNode;
        outputs: Map<string, Record<string, unknown>>;
        dumpTargets: InlineWorkflowDumpTarget[];
        outputDir: string;
        isBatchMode: boolean;
        executionPath: string[];
    }): Promise<Record<string, unknown>> {
        if (!params.dumpTargets.length) {
            return createNestedExecutionResult([]);
        }

        if (params.isBatchMode && params.dumpTargets.length > 1) {
            const perDumpOutputs = params.dumpTargets.map(() => {
                const clonedOutputs = new Map<string, Record<string, unknown>>();
                for (const [nodeId, nodeOutput] of params.outputs.entries()) {
                    clonedOutputs.set(nodeId, { ...nodeOutput });
                }
                return clonedOutputs;
            });
            const aggregatedArtifacts: InlineExposureArtifact[] = [];
            const artifactGroups = await runWithConcurrencyLimit(
                params.dumpTargets,
                resolveInlineNestedPluginConcurrency(params.dumpTargets.length),
                async (dumpTarget, index) => {
                    const execution = await this.inlineWorkflowRuntime.executePluginNode({
                        node: params.node,
                        workflow: params.executionData.workflow,
                        nestedPlugins: params.executionData.nestedPlugins,
                        outputs: perDumpOutputs[index],
                        dumpTarget,
                        outputDir: `${params.outputDir}_batch_${index}`,
                        trajectoryId: params.executionData.trajectoryId,
                        trajectoryFrames: params.executionData.trajectoryFrames,
                        analysisId: params.executionData.analysisId,
                        analysis: {
                            _id: params.executionData.analysisId,
                            pluginDisplayName: params.executionData.pluginId
                        },
                        teamId: params.executionData.teamId ?? '',
                        rootNodeId: params.node.id,
                        executionPath: params.executionPath,
                        logSinkFactory: (context) => this.createAnalysisLogSink(
                            params.jobId,
                            params.executionData,
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

            return createNestedExecutionResult(aggregatedArtifacts);
        }

        const dumpTarget = params.dumpTargets[0];
        const execution = await this.inlineWorkflowRuntime.executePluginNode({
            node: params.node,
            workflow: params.executionData.workflow,
            nestedPlugins: params.executionData.nestedPlugins,
            outputs: params.outputs,
            dumpTarget,
            outputDir: params.outputDir,
            trajectoryId: params.executionData.trajectoryId,
            trajectoryFrames: params.executionData.trajectoryFrames,
            analysisId: params.executionData.analysisId,
            analysis: {
                _id: params.executionData.analysisId,
                pluginDisplayName: params.executionData.pluginId
            },
            teamId: params.executionData.teamId ?? '',
            rootNodeId: params.node.id,
            executionPath: params.executionPath,
            logSinkFactory: (context) => this.createAnalysisLogSink(
                params.jobId,
                params.executionData,
                [dumpTarget.timestep],
                {
                    nodeId: context.nodeId,
                    nodeType: context.nodeType,
                    pluginId: context.pluginId,
                    executionPath: context.executionPath
                }
            )
        });

        return execution.output;
    }

    private async executeEntrypointNodeForRuntime(params: {
        jobId: string;
        executionData: AnalysisJobExecutionData;
        workflow: WorkflowGraph;
        outputs: Map<string, Record<string, unknown>>;
        node: WorkflowNode;
        dumpTargets: InlineWorkflowDumpTarget[];
        outputDir: string;
        executionPath: string[];
    }): Promise<Record<string, unknown>> {
        const entrypointData = isRecord(params.node.data.entrypoint)
            ? params.node.data.entrypoint
            : {};
        const binaryObjectPath = typeof entrypointData.binaryObjectPath === 'string'
            ? entrypointData.binaryObjectPath
            : params.executionData.binaryObjectPath;
        const argumentsTemplate = typeof entrypointData.arguments === 'string'
            ? entrypointData.arguments
            : params.executionData.arguments;
        const entrypointType = entrypointData.type === EntrypointType.PythonScript
            ? EntrypointType.PythonScript
            : entrypointData.type === EntrypointType.PackagedExecutable
                ? EntrypointType.PackagedExecutable
                : params.executionData.entrypointType ?? EntrypointType.Executable;
        const requirementsFile = typeof entrypointData.requirementsFile === 'string'
            ? entrypointData.requirementsFile
            : params.executionData.requirementsFile;
        const entrypointScript = typeof entrypointData.entrypointScript === 'string'
            ? entrypointData.entrypointScript
            : params.executionData.entrypointScript;
        const timeoutMs = typeof entrypointData.timeout === 'number' && Number.isFinite(entrypointData.timeout)
            ? entrypointData.timeout
            : params.executionData.timeoutMs;
        const executionRuntime = await this.pluginBinaryCacheService.getExecutionRuntime({
            binaryObjectPath,
            entrypointType,
            requirementsFile,
            entrypointScript
        });

        params.outputs.set(params.node.id, {
            ...(params.outputs.get(params.node.id) ?? {}),
            projectPath: executionRuntime.projectPath ?? ''
        });
        const resolvedArgs = resolveWorkflowTemplate(argumentsTemplate, params.outputs, {
            workflow: params.workflow,
            currentNodeId: params.node.id
        });
        const args = parseInlineWorkflowArguments(resolvedArgs);
        const binaryExecutionLease = acquireBinaryExecutionLease(args);
        if (
            typeof binaryExecutionLease.requestedThreads === 'number'
            && typeof binaryExecutionLease.appliedThreads === 'number'
            && binaryExecutionLease.appliedThreads !== binaryExecutionLease.requestedThreads
        ) {
            logger.info(
                {
                    jobId: params.jobId,
                    requestedThreads: binaryExecutionLease.requestedThreads,
                    appliedThreads: binaryExecutionLease.appliedThreads,
                    activeBinaryExecutions: binaryExecutionLease.activeBinaryExecutions
                },
                'Adjusted plugin binary thread count to fit concurrent cluster load'
            );
        }

        const executionArgs = [...executionRuntime.argsPrefix, ...binaryExecutionLease.args];
        logger.info(
            {
                jobId: params.jobId,
                binary: path.basename(executionRuntime.artifactPath),
                args: executionArgs,
                outputDir: params.outputDir,
                entrypointType
            },
            'Executing plugin binary'
        );

        const startedAt = Date.now();
        let result: Awaited<ReturnType<BinaryExecutorService['executeProcess']>>;
        try {
            result = await this.binaryExecutorService.executeProcess({
                jobId: params.jobId,
                commandPath: executionRuntime.commandPath,
                args: executionArgs,
                cwd: params.outputDir,
                env: executionRuntime.env,
                timeoutMs,
                logSink: this.createAnalysisLogSink(
                    params.jobId,
                    params.executionData,
                    params.dumpTargets.map((dumpTarget) => dumpTarget.timestep),
                    {
                        nodeId: params.node.id,
                        nodeType: params.node.type,
                        pluginId: params.executionData.pluginId,
                        executionPath: params.executionPath
                    }
                )
            });
        } finally {
            binaryExecutionLease.release();
        }

        if (result.code !== 0) {
            throw new Error(`Binary exited with code ${result.code}: ${result.stderr || result.stdout}`);
        }

        const outputFiles = await fs.readdir(params.outputDir).catch(() => []);
        logger.info(
            {
                jobId: params.jobId,
                exitCode: result.code,
                durationMs: Date.now() - startedAt,
                stdoutPreview: result.stdout.slice(0, 4000),
                stderrPreview: result.stderr.slice(0, 4000),
                outputFiles
            },
            'Binary execution completed'
        );

        return {
            binaryObjectPath,
            commandPath: executionRuntime.commandPath,
            artifactPath: executionRuntime.artifactPath,
            args: executionArgs,
            resolvedArguments: resolvedArgs,
            outputPath: params.outputDir,
            projectPath: executionRuntime.projectPath ?? '',
            outputFiles,
            exitCode: result.code,
            stdout: result.stdout,
            stderr: result.stderr
        };
    }

    private async executeExposureNodeForRuntime(params: {
        jobId: string;
        executionData: AnalysisJobExecutionData;
        node: WorkflowNode;
        outputs: Map<string, Record<string, unknown>>;
        outputDir: string;
        timestep: number;
        artifactUploadBatch: ArtifactUploadBatch;
    }): Promise<void> {
        const exposure = params.executionData.exposures.find((candidate) => candidate.nodeId === params.node.id);
        if (!exposure?.results) {
            params.outputs.set(params.node.id, {
                processed: false,
                skipped: true,
                reason: 'Exposure node has no configured results file'
            });
            return;
        }

        if (isMemoryPressured()) {
            logger.warn(
                { jobId: params.jobId, exposure: exposure.name },
                'Heap pressure detected between exposures — forcing GC and yielding'
            );
            forceGC();
            await new Promise((resolve) => setImmediate(resolve));
        }

        const startedAt = Date.now();
        logger.info(
            {
                jobId: params.jobId,
                exposureName: exposure.name,
                exposureNodeId: exposure.nodeId,
                exposureResults: exposure.results,
                outputDir: params.outputDir
            },
            'Starting exposure result processing'
        );
        await this.resultProcessorService.processExposureResult(
            params.executionData,
            exposure,
            params.outputDir,
            params.timestep,
            params.executionData.teamId ?? '',
            params.artifactUploadBatch
        );
        logger.info(
            {
                jobId: params.jobId,
                exposureName: exposure.name,
                exposureNodeId: exposure.nodeId,
                durationMs: Date.now() - startedAt
            },
            'Completed exposure result processing'
        );
        params.outputs.set(params.node.id, {
            processed: true,
            results: exposure.results,
            outputFilePath: `${params.outputDir}_${exposure.results}`
        });
        forceGC();
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
