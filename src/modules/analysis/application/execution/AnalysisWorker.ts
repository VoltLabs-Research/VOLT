import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { forceGC, isMemoryPressured } from '@/core/memory';
import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { QueueService } from '@/core/queues/application/QueueService';
import { delayJobOnQueueScopeContention, tryAcquireQueueScopeLease } from '@/core/queues/contracts/queue-scope-lease';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import { createWorkflowNodeRegistry } from '@/modules/analysis/application/workflow/createWorkflowNodeRegistry';
import { createWorkflowExecutionContext } from '@/modules/analysis/application/workflow/WorkflowExecutionContextFactory';
import { InlineWorkflowRuntime } from '@/modules/analysis/application/workflow/InlineWorkflowRuntime';
import { createNestedExecutionResult, readNestedExposureItems } from '@/modules/analysis/application/workflow/InlineWorkflowShared';
import { executeWorkflowEntrypoint } from '@/modules/analysis/application/workflow/WorkflowEntrypointExecution';
import { isWorkflowRuntimeNodeReady, resolveWorkflowRuntimeChildNodeIds } from '@/modules/analysis/application/workflow/WorkflowRuntimeScheduling';
import { inflateAnalysisExecutionData } from '@/support/policies/analysis-execution-data';
import type { QueueScopeLease } from '@/core/queues/contracts/queue-scope-lease';
import type { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import type { WorkflowNode } from '@/modules/analysis/contracts/workflow.types';
import type { InlineExposureArtifact, InlineWorkflowDumpTarget } from '@/modules/analysis/application/workflow/InlineWorkflowShared';
import { getRecommendedBinaryThreads, getSafeAnalysisWorkerConcurrency } from '@/support/policies/analysis-resource-policy';
import { isRecord } from '@/support/type-guards/isRecord';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createZstdDecompressionStream } from '@/support/serialization/storage-codec';
import { pipeline } from 'node:stream/promises';
import { DelayedError } from 'bullmq';
import type { ArtifactUploadBatch, ArtifactUploadQueueService } from '@/modules/plugin/application/artifacts/ArtifactUploadQueueService';
import type { ResultProcessorService } from '@/modules/plugin/application/exports/ResultProcessorService';
import { EntrypointType, ObjectBucketName } from '@/contracts';
import type { AnalysisJobExecutionData, AnalysisQueueJobPayload } from '@/contracts';
import type { AnalysisExecutionDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisExecutionDataStore';
import type { RedisConnectionService } from '@/core/storage/infrastructure/redis/RedisConnectionService';
import type { Job as BullMQJob, Worker } from 'bullmq';
import { createAnalysisExecutionLogSink, type ExecutionLogSegmentMetadata } from '@/core/runtime/infrastructure/ExecutionLogStreaming';
import type { BinaryExecutorService, ProcessExecutionLogSink } from '@/core/runtime/infrastructure/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/plugin/application/binaries/PluginBinaryCacheService';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';

interface AnalysisJobStatusReporter {
    reportAnalysisLogChunk(input: {
        jobId: string;
        analysisId: string;
        teamId: string;
        trajectoryId: string;
        timestep: number;
        segments: import('@/contracts').TeamClusterDaemonExecutionLogSegment[];
    }): Promise<void>;
    reportAnalysisJobStatus(input: {
        jobId: string;
        name: string;
        analysisId: string;
        teamId: string;
        trajectoryId?: string;
        trajectoryName?: string;
        timestep?: number;
        status: 'running' | 'completed' | 'failed';
        error?: string;
    }): Promise<void>;
    reportArtifactUploadJobStatus(input: {
        jobId: string;
        analysisId: string;
        teamId: string;
        trajectoryId: string;
        trajectoryName?: string;
        timestep?: number;
        status: 'queued' | 'running' | 'completed' | 'failed';
        error?: string;
    }): Promise<void>;
    reportJobCompletion(input: {
        jobId: string;
        name: string;
        analysisId: string;
        teamId: string;
        timestep?: number;
        success: boolean;
        error?: string;
    }): Promise<void>;
}

const DUMPS_BUCKET = ObjectBucketName.Dumps;
let activeBinaryExecutions = 0;

const MAX_INLINE_NESTED_PLUGIN_CONCURRENCY = 2;

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
const applyBatchContextDumpPaths = (
    contextOutput: Record<string, unknown>,
    dumpTargets: InlineWorkflowDumpTarget[],
    outputDir: string
): Record<string, unknown> => {
    const dumpPaths = dumpTargets.map((dumpTarget) => ({
        timestep: dumpTarget.timestep,
        natoms: dumpTarget.natoms,
        simulationCell: dumpTarget.simulationCell,
        path: dumpTarget.localPath,
        originalPath: dumpTarget.originalPath
    }));

    return {
        ...contextOutput,
        trajectory_dumps: dumpPaths,
        trajectory: {
            ...(isRecord(contextOutput.trajectory) ? contextOutput.trajectory : {}),
            frames: dumpPaths
        },
        allDumpLocalPaths: JSON.stringify(dumpTargets.map((dumpTarget) => dumpTarget.localPath)),
        outputPath: outputDir
    };
};

interface PreparedAnalysisRuntime {
    outputDir: string;
    outputs: Map<string, Record<string, unknown>>;
    dumpTargets: InlineWorkflowDumpTarget[];
    dumpLocalPaths: string[];
}

export class AnalysisWorker {
    private running = false;
    private worker: Worker<AnalysisQueueJobPayload> | null = null;
    private readonly workflowNodeRegistry = createWorkflowNodeRegistry();
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
        private readonly daemonJobReporterService: AnalysisJobStatusReporter
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
        const teamId = executionData.teamId ?? '';
        const trajectoryId = executionData.trajectoryId;
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

    start(concurrency?: number): void {
        if (this.running) {
            return;
        }

        const requestedConcurrency = concurrency ?? 1;
        const effectiveConcurrency = getSafeAnalysisWorkerConcurrency(requestedConcurrency);
        this.running = true;
        this.worker = this.queueService.createWorker<AnalysisQueueJobPayload>(
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

    private async processJob(job: AnalysisQueueJobPayload, bullJob: BullMQJob<AnalysisQueueJobPayload>): Promise<void> {
        if (isMemoryPressured()) {
            const delayMs = 30_000;
            logger.warn(
                { jobId: job.jobId, delayMs },
                'Heap memory pressure detected — delaying analysis job'
            );
            await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
            throw new DelayedError();
        }

        const metadata = (job.metadata ?? {}) as Record<string, unknown>;
        const forEachItem = (metadata.forEachItem ?? {}) as Record<string, unknown>;
        const forEachIndex = typeof metadata.forEachIndex === 'number' ? metadata.forEachIndex : 0;
        let executionData: AnalysisJobExecutionData | null = null;
        let isBatchMode = false;
        let timestep: number | undefined;
        let runtime: PreparedAnalysisRuntime | null = null;
        let artifactUploadBatch: ArtifactUploadBatch | null = null;
        let queueScopeLease: QueueScopeLease | null = null;

        try {
            executionData = await this.resolveExecutionData(job);
            queueScopeLease = await this.acquireQueueScopeLease(job, bullJob, executionData);

            isBatchMode = executionData.batchMode === true;
            timestep = isBatchMode ? undefined : this.resolveJobTimestep(job, metadata);

            if (!isBatchMode && typeof timestep === 'undefined') {
                throw new Error(`Missing timestep for analysis job ${job.jobId}`);
            }

            artifactUploadBatch = this.createArtifactUploadBatch(job, executionData, metadata, timestep);
            this.reportRunningStatus(job, executionData, metadata, timestep);
            runtime = await this.prepareLocalExecution({
                executionData,
                metadata,
                forEachItem,
                forEachIndex,
                timestep,
                isBatchMode
            });

            await bullJob.updateProgress(10);
            await this.executeRuntimeWorkflow({
                jobId: job.jobId,
                executionData,
                outputs: runtime.outputs,
                dumpTargets: runtime.dumpTargets,
                outputDir: runtime.outputDir,
                timestep: runtime.dumpTargets[0]?.timestep ?? 0,
                artifactUploadBatch,
                isBatchMode
            });
            await bullJob.updateProgress(70);

            const { jobId: artifactUploadJobId } = await artifactUploadBatch.enqueue();
            if (artifactUploadJobId) {
                await this.reportQueuedArtifactUpload(artifactUploadJobId, job, executionData, metadata, timestep);
            }

            await bullJob.updateProgress(95);

            await this.reportJobCompletion(job, executionData.analysisId, timestep, true);

            await bullJob.updateProgress(100);
        } catch (error: unknown) {
            if (error instanceof DelayedError) {
                throw error;
            }

            const message = error instanceof Error ? error.message : String(error);
            logger.error({ jobId: job.jobId, err: error }, `Job failed: ${message}`);
            const analysisId = executionData?.analysisId
                ?? (typeof metadata.analysisId === 'string' ? metadata.analysisId : 'unknown-analysis');

            await this.reportJobCompletion(job, analysisId, timestep, false, message).catch(() => {});

            throw error instanceof Error ? error : new Error(message);
        } finally {
            const dumpPathsToClean = runtime?.dumpLocalPaths ?? [];

            if (dumpPathsToClean.length > 0) {
                const cleanupTask = runtime?.outputDir
                    ? this.cleanupBatch(dumpPathsToClean, runtime.outputDir)
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

    private async acquireQueueScopeLease(
        job: AnalysisQueueJobPayload,
        bullJob: BullMQJob<AnalysisQueueJobPayload>,
        executionData: AnalysisJobExecutionData
    ): Promise<QueueScopeLease> {
        const trajectoryId = executionData.trajectoryId.trim();
        if (!trajectoryId) {
            throw new Error(`Missing trajectoryId for analysis ${executionData.analysisId}`);
        }

        const queueScopeLimits = this.queueScopeLimitsRegistry.getSnapshot();
        const trajectoryScope = {
            scope: 'trajectory' as const,
            scopeId: trajectoryId,
            limit: queueScopeLimits.analysisProcessing.maxRunningPerTrajectory
        };
        const { lease, blockingScope } = await tryAcquireQueueScopeLease(
            this.redisConnectionService,
            ANALYSIS_QUEUE_NAME,
            [
                trajectoryScope,
                {
                    scope: 'team',
                    scopeId: executionData.teamId ?? '',
                    limit: queueScopeLimits.analysisProcessing.maxRunningPerTeam
                }
            ]
        );

        if (lease && !blockingScope) {
            return lease;
        }

        await delayJobOnQueueScopeContention(bullJob, {
            queueName: ANALYSIS_QUEUE_NAME,
            jobId: job.jobId,
            scope: blockingScope ?? trajectoryScope
        });

        throw new DelayedError();
    }

    private createArtifactUploadBatch(
        job: AnalysisQueueJobPayload,
        executionData: AnalysisJobExecutionData,
        metadata: Record<string, unknown>,
        timestep: number | undefined
    ): ArtifactUploadBatch {
        return this.artifactUploadQueueService.createBatch({
            analysisId: executionData.analysisId,
            analysisJobId: job.jobId,
            teamId: job.teamId,
            trajectoryId: executionData.trajectoryId,
            trajectoryName: typeof metadata.trajectoryName === 'string' ? metadata.trajectoryName : undefined,
            timestep
        });
    }

    private reportRunningStatus(
        job: AnalysisQueueJobPayload,
        executionData: AnalysisJobExecutionData,
        metadata: Record<string, unknown>,
        timestep: number | undefined
    ): void {
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
    }

    private async executeReadyRuntimeChild(
        params: Parameters<AnalysisWorker['executeRuntimeNode']>[0],
        childNode: WorkflowNode,
        executionPath: string[]
    ): Promise<void> {
        if (!isWorkflowRuntimeNodeReady(params.workflow, childNode.id, params.outputs, params.visitedNodeIds)) {
            return;
        }

        await this.executeRuntimeNode({
            ...params,
            node: childNode,
            executionPath
        });
    }

    private async prepareLocalExecution(input: {
        executionData: AnalysisJobExecutionData;
        metadata: Record<string, unknown>;
        forEachItem: Record<string, unknown>;
        forEachIndex: number;
        timestep: number | undefined;
        isBatchMode: boolean;
    }): Promise<PreparedAnalysisRuntime> {
        const dumpOwnerClusterId = input.executionData.storageClusterId;
        if (!dumpOwnerClusterId) {
            throw new Error(`Missing storageClusterId for analysis ${input.executionData.analysisId}`);
        }

        const dumpLocalPaths: string[] = [];
        let outputDir: string | null = null;

        try {
            if (input.isBatchMode && input.executionData.allDumpUrls?.length) {
                for (const dumpUrl of input.executionData.allDumpUrls) {
                    dumpLocalPaths.push(await this.downloadDump(dumpUrl, dumpOwnerClusterId));
                }
            } else {
                dumpLocalPaths.push(await this.downloadDump(
                    typeof input.metadata.inputFile === 'string' ? input.metadata.inputFile : '',
                    dumpOwnerClusterId
                ));
            }

            outputDir = path.join(
                DAEMON_PATHS.analysisOutput,
                `${input.executionData.analysisId}-${input.forEachIndex}-${Date.now()}`
            );
            await fs.mkdir(outputDir, { recursive: true });

            const outputs = input.isBatchMode
                ? this.buildBatchOutputsMap(input.executionData, dumpLocalPaths, outputDir)
                : this.buildOutputsMap(
                    input.executionData,
                    input.forEachItem,
                    input.forEachIndex,
                    dumpLocalPaths[0],
                    outputDir
                );
            const dumpTargets = input.isBatchMode
                ? this.createDumpExecutionTargets(input.executionData, dumpLocalPaths)
                : this.createDumpExecutionTargets(input.executionData, dumpLocalPaths, input.timestep);

            return {
                outputDir,
                outputs,
                dumpTargets,
                dumpLocalPaths
            };
        } catch (error) {
            if (dumpLocalPaths.length > 0) {
                const cleanup = outputDir
                    ? this.cleanupBatch(dumpLocalPaths, outputDir)
                    : this.cleanupDumpPaths(dumpLocalPaths);
                await cleanup.catch(() => {});
            }

            throw error;
        }
    }

    private async reportQueuedArtifactUpload(
        artifactUploadJobId: string,
        job: AnalysisQueueJobPayload,
        executionData: AnalysisJobExecutionData,
        metadata: Record<string, unknown>,
        timestep: number | undefined
    ): Promise<void> {
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

    private async reportJobCompletion(
        job: AnalysisQueueJobPayload,
        analysisId: string,
        timestep: number | undefined,
        success: boolean,
        error?: string
    ): Promise<void> {
        await this.daemonJobReporterService.reportJobCompletion({
            jobId: job.jobId,
            name: job.name,
            analysisId,
            teamId: job.teamId,
            timestep,
            success,
            error
        });
    }

    private resolveJobTimestep(
        job: AnalysisQueueJobPayload,
        metadata: Record<string, unknown>
    ): number | undefined {
        if (typeof job.timestep === 'number' && Number.isFinite(job.timestep)) {
            return job.timestep;
        }

        if (typeof metadata.timestep === 'number' && Number.isFinite(metadata.timestep)) {
            return metadata.timestep;
        }

        return undefined;
    }

    private async resolveExecutionData(job: AnalysisQueueJobPayload): Promise<AnalysisJobExecutionData> {
        if (job.executionDataReference) {
            const referencedExecutionData = await this.analysisExecutionDataStore.get(job.executionDataReference);
            if (referencedExecutionData) {
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
        const runtimeRootNodes = workflow.getRuntimeRootNodes();
        const rootNodes = runtimeRootNodes.length > 0
            ? runtimeRootNodes
            : workflow.nodes.filter((node) => node.type === WorkflowNodeType.Entrypoint);
        const visitedNodeIds = new Set<string>(params.outputs.keys());

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
            for (const childNode of params.workflow.getChildren(params.node.id)) {
                await this.executeReadyRuntimeChild(params, childNode, [...params.executionPath, childNode.id]);
            }
            return;
        }

        if (params.node.type === WorkflowNodeType.Plugin) {
            const pluginOutput = await this.executePluginNodeForRuntime(params);
            params.outputs.set(params.node.id, pluginOutput);
            for (const childNode of params.workflow.getChildren(params.node.id)) {
                await this.executeReadyRuntimeChild(params, childNode, [...params.executionPath, childNode.id]);
            }
            return;
        }

        if (params.node.type === WorkflowNodeType.Entrypoint) {
            const entrypointOutput = await this.executeEntrypointNodeForRuntime(params);
            params.outputs.set(params.node.id, entrypointOutput);
            for (const childNode of params.workflow.getChildren(params.node.id)) {
                await this.executeReadyRuntimeChild(params, childNode, [...params.executionPath, childNode.id]);
            }
            return;
        }

        if (!this.workflowNodeRegistry.has(params.node.type)) {
            return;
        }

        const output = await this.workflowNodeRegistry.execute(params.node, params.runtimeContext);
        params.outputs.set(params.node.id, output);

        if (params.node.type === WorkflowNodeType.IfStatement) {
            const childNodes = resolveWorkflowRuntimeChildNodeIds(params.workflow, params.node, output).activeNodeIds
                .map((childNodeId) => params.workflow.nodes.find((candidate) => candidate.id === childNodeId))
                .filter((childNode): childNode is WorkflowNode => Boolean(childNode));

            for (const childNode of childNodes) {
                await this.executeReadyRuntimeChild(params, childNode, [...params.executionPath, childNode.id]);
            }
            return;
        }

        if (params.node.type === WorkflowNodeType.SwitchStatement) {
            const childNodes = resolveWorkflowRuntimeChildNodeIds(params.workflow, params.node, output).activeNodeIds
                .map((childNodeId) => params.workflow.nodes.find((candidate) => candidate.id === childNodeId))
                .filter((childNode): childNode is WorkflowNode => Boolean(childNode));

            for (const childNode of childNodes) {
                await this.executeReadyRuntimeChild(params, childNode, [...params.executionPath, childNode.id]);
            }
            return;
        }

        for (const childNode of params.workflow.getChildren(params.node.id)) {
            await this.executeReadyRuntimeChild(params, childNode, [...params.executionPath, childNode.id]);
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
                Math.max(1, Math.min(MAX_INLINE_NESTED_PLUGIN_CONCURRENCY, params.dumpTargets.length)),
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
        const entrypointData = params.node.data.entrypoint;
        const binaryObjectPath = entrypointData?.binaryObjectPath || params.executionData.binaryObjectPath;
        const argumentsTemplate = entrypointData?.arguments || params.executionData.arguments;
        const entrypointType = entrypointData?.type || params.executionData.entrypointType || EntrypointType.Executable;
        const timeoutMs = entrypointData?.timeout ?? params.executionData.timeoutMs;

        return executeWorkflowEntrypoint({
            outputs: params.outputs,
            workflow: params.workflow,
            nodeId: params.node.id,
            entrypoint: {
                binaryObjectPath,
                argumentsTemplate,
                entrypointType,
                requirementsFile: entrypointData?.requirementsFile ?? params.executionData.requirementsFile,
                entrypointScript: entrypointData?.entrypointScript ?? params.executionData.entrypointScript,
                timeoutMs
            },
            jobId: params.jobId,
            outputDir: params.outputDir,
            pluginBinaryCacheService: this.pluginBinaryCacheService,
            binaryExecutorService: this.binaryExecutorService,
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
            ),
            prepareArgs: (args) => {
                const binaryExecutionLease = acquireBinaryExecutionLease(args);

                return {
                    args: binaryExecutionLease.args,
                    release: binaryExecutionLease.release
                };
            },
            includeOutputFiles: true,
            nonZeroExitMessage: (result) => `Binary exited with code ${result.code}: ${result.stderr || result.stdout}`
        });
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

        await this.resultProcessorService.processExposureResult(
            params.executionData,
            exposure,
            params.outputDir,
            params.timestep,
            params.executionData.teamId ?? '',
            params.artifactUploadBatch
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
        const batchTrajectoryDumps = executionData.batchTrajectoryDumps ?? [];
        const batchDumpMetadataByPath = new Map(
            batchTrajectoryDumps.map((dump) => [dump.path, dump])
        );
        const frameMetadataByTimestep = new Map(
            executionData.trajectoryFrames.map((frame) => [frame.timestep, frame])
        );

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
        const decompressed = createZstdDecompressionStream(response.stream);
        await pipeline(decompressed.stream, createWriteStream(localPath));
        await decompressed.completion;
        return localPath;
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

};
