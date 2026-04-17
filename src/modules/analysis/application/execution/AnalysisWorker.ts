import Bottleneck from 'bottleneck';

import { QueueService } from '@/core/queues/application/QueueService'; import type { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry'; import type { QueueScopeLease } from '@/core/queues/infrastructure/queue-scope-lease'; import { delayJobOnQueueScopeContention, tryAcquireQueueScopeLease } from '@/core/queues/infrastructure/queue-scope-lease';
import { ANALYSIS_QUEUE_NAME } from '@/core/queues/contracts/queue-names'; import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore'; import { ObjectBucketName } from '@/core/storage/contracts/http.objectStore'; import type { RedisConnectionService } from '@/core/storage/infrastructure/redis/RedisConnectionService';
import type { BinaryExecutorService, ProcessExecutionLogSink } from '@/core/runtime/infrastructure/BinaryExecutorService'; import { createAnalysisExecutionLogSink } from '@/core/runtime/infrastructure/ExecutionLogStreaming'; import type { ExecutionLogSegmentMetadata } from '@/core/runtime/infrastructure/ExecutionLogStreaming'; import { EntrypointType } from '@/core/runtime/contracts/http.runtime';
import { logger } from '@/core/logger'; import { forceGC, isMemoryPressured } from '@/core/memory'; import { DAEMON_PATHS } from '@/core/paths'; import type { AnalysisLogChunkReportedEventData } from '@/modules/analysis/application/events/AnalysisLogChunkReportedEvent';
import type { ExecutionLogSegment } from '@/modules/analysis/application/events/ExecutionLogSegment'; import { createWorkflowExecutionContext } from '@/modules/analysis/application/workflow/WorkflowExecutionContextFactory'; import { executeWorkflowEntrypoint } from '@/modules/analysis/application/workflow/WorkflowEntrypointExecution';
import { createNestedExecutionResult } from '@/modules/analysis/application/workflow/InlineWorkflowShared'; import type { InlineExposureArtifact, InlineWorkflowDumpTarget, WorkflowExecutionResultOutput } from '@/modules/analysis/application/workflow/InlineWorkflowShared'; import { InlineWorkflowRuntime } from '@/modules/analysis/application/workflow/InlineWorkflowRuntime';
import { createWorkflowNodeRegistry } from '@/modules/analysis/application/workflow/createWorkflowNodeRegistry'; import { isWorkflowRuntimeNodeReady, resolveWorkflowRuntimeChildNodeIds } from '@/modules/analysis/application/workflow/WorkflowRuntimeScheduling'; import type { AnalysisExecutionDataReference, AnalysisJobExecutionData, AnalysisQueueJobPayload } from '@/modules/analysis/contracts/http.analysis';
import type { WorkflowNode, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types'; import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types'; import type { AnalysisCompletedEventData } from '@/modules/analysis/domain/events/AnalysisCompletedEvent';
import type { AnalysisFailedEventData } from '@/modules/analysis/domain/events/AnalysisFailedEvent'; import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events/shared/BaseAnalysisEventData'; import type { AnalysisExecutionDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisExecutionDataStore';
import type { PluginBinaryCacheService } from '@/modules/plugin/application/binaries/PluginBinaryCacheService'; import type { ArtifactUploadBatch, ArtifactUploadQueueService } from '@/modules/plugin/application/artifacts/ArtifactUploadQueueService'; import type { ResultProcessorService } from '@/modules/plugin/application/exports/ResultProcessorService.contract';
import type { ArtifactUploadFailedEventData } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadFailedEvent'; import type { ArtifactUploadQueuedEventData } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadQueuedEvent'; import type { ArtifactUploadStartedEventData } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadStartedEvent';
import { getRecommendedBinaryThreads, getSafeAnalysisWorkerConcurrency } from '@/support/policies/analysis-resource-policy'; import { inflateAnalysisExecutionData } from '@/support/policies/analysis-execution-data'; import { createZstdDecompressionStream } from '@/support/serialization/storage-codec';
import { dir as createTempDir } from 'tmp-promise';
import { createWriteStream } from 'node:fs'; import { pipeline } from 'node:stream/promises'; import { DelayedError, type Job as BullMQJob, type Worker } from 'bullmq'; import fg from 'fast-glob'; import fs from 'node:fs/promises'; import path from 'node:path';

type AnalysisOutput = WorkflowNodeOutput;

interface AnalysisJobMetadata {
    [key: string]: AnalysisOutput | number | string | undefined;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    inputFile?: string;
    forEachItem?: AnalysisOutput;
    forEachIndex?: number;
}

interface AnalysisJobStatusReporter {
    reportAnalysisCompleted(input: AnalysisCompletedEventData): Promise<void>;
    reportAnalysisFailed(input: AnalysisFailedEventData): Promise<void>;
    reportAnalysisLogChunk(input: AnalysisLogChunkReportedEventData): Promise<void>;
    reportAnalysisStarted(input: BaseAnalysisEventData): Promise<void>;
    reportArtifactUploadFailed(input: ArtifactUploadFailedEventData): Promise<void>;
    reportArtifactUploadQueued(input: ArtifactUploadQueuedEventData): Promise<void>;
    reportArtifactUploadStarted(input: ArtifactUploadStartedEventData): Promise<void>;
}

interface ResolvedAnalysisJobExecutionData extends AnalysisJobExecutionData {
    teamId: string;
}

interface AnalysisWorkerJobPayload extends AnalysisQueueJobPayload {
    jobId: string;
    teamId: string;
    name: string;
    timestep?: number;
    executionData?: AnalysisJobExecutionData;
    executionDataCompressed?: string;
    executionDataReference?: AnalysisExecutionDataReference;
    metadata?: AnalysisJobMetadata;
}

interface PrepareLocalExecutionInput {
    executionData: ResolvedAnalysisJobExecutionData;
    inputFile?: string;
    forEachItem?: AnalysisOutput;
    forEachIndex: number;
    timestep: number | undefined;
    isBatchMode: boolean;
}

type JobCompletionStatus = 'completed' | 'failed';

interface ExecuteRuntimeWorkflowParams {
    jobId: string;
    executionData: ResolvedAnalysisJobExecutionData;
    outputs: Map<string, AnalysisOutput>;
    dumpTargets: InlineWorkflowDumpTarget[];
    outputDir: string;
    timestep: number;
    artifactUploadBatch: ArtifactUploadBatch;
    isBatchMode: boolean;
}

interface ExecuteRuntimeNodeParams extends ExecuteRuntimeWorkflowParams {
    workflow: WorkflowGraph;
    runtimeContext: ReturnType<typeof createWorkflowExecutionContext>;
    node: WorkflowNode;
    visitedNodeIds: Set<string>;
    executionPath: string[];
}

interface ExecutePluginNodeParams {
    jobId: string;
    executionData: ResolvedAnalysisJobExecutionData;
    node: WorkflowNode;
    outputs: Map<string, AnalysisOutput>;
    dumpTargets: InlineWorkflowDumpTarget[];
    outputDir: string;
    isBatchMode: boolean;
    executionPath: string[];
}

interface ExecuteEntrypointNodeParams {
    jobId: string;
    executionData: ResolvedAnalysisJobExecutionData;
    workflow: WorkflowGraph;
    outputs: Map<string, AnalysisOutput>;
    node: WorkflowNode;
    dumpTargets: InlineWorkflowDumpTarget[];
    outputDir: string;
    executionPath: string[];
}

interface ExecuteExposureNodeParams {
    jobId: string;
    executionData: ResolvedAnalysisJobExecutionData;
    node: WorkflowNode;
    outputs: Map<string, AnalysisOutput>;
    outputDir: string;
    timestep: number;
    artifactUploadBatch: ArtifactUploadBatch;
}

interface BinaryExecutionLease {
    args: string[];
    requestedThreads?: number;
    appliedThreads?: number;
    activeBinaryExecutions: number;
    release: () => void;
}

interface PreparedAnalysisRuntime {
    outputDir: string;
    outputs: Map<string, AnalysisOutput>;
    dumpTargets: InlineWorkflowDumpTarget[];
    dumpLocalPaths: string[];
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

    const limiter = new Bottleneck({
        maxConcurrent: Math.max(1, Math.min(concurrency, items.length))
    });

    try {
        return await Promise.all(items.map((item, index) => {
            return limiter.schedule(() => task(item, index));
        }));
    } finally {
        await limiter.stop({
            dropWaitingJobs: false
        });
    }
};

const acquireBinaryExecutionLease = (args: string[]): BinaryExecutionLease => {
    activeBinaryExecutions += 1;
    const currentActiveExecutions = activeBinaryExecutions;
    const release = (): void => {
        activeBinaryExecutions = Math.max(0, activeBinaryExecutions - 1);
    };

    const threadsArgumentIndex = args.findIndex((arg, index) => arg === '--threads' && index < args.length - 1);
    if (threadsArgumentIndex === -1) {
        return {
            args: [...args],
            activeBinaryExecutions: currentActiveExecutions,
            release
        };
    }

    const requestedThreads = Number.parseInt(args[threadsArgumentIndex + 1], 10);
    if (Number.isNaN(requestedThreads) || requestedThreads < 1) {
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
    adjustedArgs[threadsArgumentIndex + 1] = appliedThreads.toString();

    return {
        args: adjustedArgs,
        requestedThreads,
        appliedThreads,
        activeBinaryExecutions: currentActiveExecutions,
        release
    };
};

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
        executionData: ResolvedAnalysisJobExecutionData,
        timesteps: number[],
        metadata: ExecutionLogSegmentMetadata
    ): ProcessExecutionLogSink | undefined {
        const { teamId, trajectoryId } = executionData;
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
            (jobPayload, job) => this.processJob(jobPayload as AnalysisWorkerJobPayload, job),
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

    private async processJob(job: AnalysisWorkerJobPayload, bullJob: BullMQJob<AnalysisQueueJobPayload>): Promise<void> {
        if (isMemoryPressured()) {
            const delayMs = 30_000;
            logger.warn(
                { jobId: job.jobId, delayMs },
                'Heap memory pressure detected — delaying analysis job'
            );
            await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
            throw new DelayedError();
        }

        const metadata: AnalysisJobMetadata = job.metadata ?? {};
        const forEachIndex = metadata?.forEachIndex ?? 0;
        let executionData: ResolvedAnalysisJobExecutionData | null = null;
        let isBatchMode = false;
        let timestep: number | undefined;
        let runtime: PreparedAnalysisRuntime | null = null;
        let artifactUploadBatch: ArtifactUploadBatch | null = null;
        let queueScopeLease: QueueScopeLease | null = null;

        try {
            executionData = await this.resolveExecutionData(job);
            queueScopeLease = await this.acquireQueueScopeLease(job, bullJob, executionData);

            isBatchMode = executionData.batchMode === true;
            timestep = isBatchMode ? undefined : (job.timestep ?? metadata?.timestep);

            if (!isBatchMode && timestep === undefined) {
                throw new Error(`Missing timestep for analysis job ${job.jobId}`);
            }

            artifactUploadBatch = this.artifactUploadQueueService.createBatch({
                analysisId: executionData.analysisId,
                analysisJobId: job.jobId,
                teamId: job.teamId,
                trajectoryId: executionData.trajectoryId,
                trajectoryName: metadata?.trajectoryName,
                timestep
            });
            this.daemonJobReporterService.reportAnalysisStarted({
                jobId: job.jobId,
                name: job.name,
                analysisId: executionData.analysisId,
                teamId: job.teamId,
                trajectoryId: metadata?.trajectoryId,
                trajectoryName: metadata?.trajectoryName,
                timestep
            }).catch((err) => {
                logger.warn({ jobId: job.jobId, err }, 'Failed to report running status to server');
            });
            runtime = await this.prepareLocalExecution({
                executionData,
                inputFile: metadata?.inputFile,
                forEachItem: metadata?.forEachItem,
                forEachIndex,
                timestep,
                isBatchMode
            });
            const firstDumpTarget = runtime.dumpTargets[0];
            if (!firstDumpTarget) {
                throw new Error(`Missing dump target for analysis job ${job.jobId}`);
            }

            await bullJob.updateProgress(10);
            await this.executeRuntimeWorkflow({
                jobId: job.jobId,
                executionData,
                outputs: runtime.outputs,
                dumpTargets: runtime.dumpTargets,
                outputDir: runtime.outputDir,
                timestep: firstDumpTarget.timestep,
                artifactUploadBatch,
                isBatchMode
            });
            await bullJob.updateProgress(70);

            const { jobId: artifactUploadJobId } = await artifactUploadBatch.enqueue();
            if (artifactUploadJobId) {
                await this.daemonJobReporterService.reportArtifactUploadQueued({
                    jobId: artifactUploadJobId,
                    analysisId: executionData.analysisId,
                    teamId: job.teamId,
                    trajectoryId: executionData.trajectoryId,
                    trajectoryName: metadata?.trajectoryName,
                    timestep
                }).catch((err) => {
                    logger.warn({ err, jobId: artifactUploadJobId }, 'Failed to report queued artifact upload status');
                });
            }

            await bullJob.updateProgress(95);

            await this.reportJobCompletion(job, executionData.analysisId, timestep, 'completed');

            await bullJob.updateProgress(100);
        } catch (error) {
            if (error instanceof DelayedError) {
                throw error;
            }

            const message = error instanceof Error ? error.message : `${error}`;
            logger.error({ jobId: job.jobId, err: error }, `Job failed: ${message}`);
            const analysisId = executionData
                ? executionData.analysisId
                : metadata.analysisId;

            if (analysisId) {
                await this.reportJobCompletion(job, analysisId, timestep, 'failed', message).catch(() => {});
            }

            throw error instanceof Error ? error : new Error(message);
        } finally {
            const dumpPathsToClean = runtime ? runtime.dumpLocalPaths : [];

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
        job: AnalysisWorkerJobPayload,
        bullJob: BullMQJob<AnalysisQueueJobPayload>,
        executionData: ResolvedAnalysisJobExecutionData
    ): Promise<QueueScopeLease> {
        const { trajectoryId } = executionData;
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
                    scopeId: executionData.teamId,
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

    private async prepareLocalExecution(input: PrepareLocalExecutionInput): Promise<PreparedAnalysisRuntime> {
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
                if (!input.inputFile) {
                    throw new Error(`Missing inputFile for analysis ${input.executionData.analysisId}`);
                }

                dumpLocalPaths.push(await this.downloadDump(input.inputFile, dumpOwnerClusterId));
            }

            await fs.mkdir(DAEMON_PATHS.analysisOutput, { recursive: true });
            outputDir = (await createTempDir({
                tmpdir: DAEMON_PATHS.analysisOutput,
                prefix: `${input.executionData.analysisId}-${input.forEachIndex}-`,
                unsafeCleanup: true
            })).path;

            const outputs = input.isBatchMode
                ? this.buildBatchOutputsMap(input.executionData, dumpLocalPaths, outputDir)
                : this.buildOutputsMap(
                    input.executionData,
                    input.forEachItem,
                    input.forEachIndex,
                    dumpLocalPaths[0]!,
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

    private async reportJobCompletion(
        job: AnalysisWorkerJobPayload,
        analysisId: string,
        timestep: number | undefined,
        status: JobCompletionStatus,
        error?: string
    ): Promise<void> {
        const payload = {
            jobId: job.jobId,
            name: job.name,
            analysisId,
            teamId: job.teamId,
            timestep
        };

        if (status === 'completed') {
            await this.daemonJobReporterService.reportAnalysisCompleted(payload);
            return;
        }

        await this.daemonJobReporterService.reportAnalysisFailed({
            ...payload,
            error: this.resolveJobFailureReason(error)
        });
    }

    private async resolveExecutionData(job: AnalysisWorkerJobPayload): Promise<ResolvedAnalysisJobExecutionData> {
        let executionData: AnalysisJobExecutionData | null = null;

        if (job.executionDataReference) {
            const referencedExecutionData = await this.analysisExecutionDataStore.get(job.executionDataReference);
            if (referencedExecutionData) {
                executionData = referencedExecutionData;
            }

            if (!executionData && job.executionDataCompressed && job.executionDataCompressed.length > 0) {
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
                    executionData = parsedExecutionData;
                } catch (error) {
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

            if (!executionData && job.executionData) {
                logger.warn(
                    {
                        jobId: job.jobId,
                        referenceKey: job.executionDataReference.key
                    },
                    'Falling back to inline analysis execution data after reference resolution miss'
                );
                executionData = job.executionData;
            }
        }

        if (!executionData && job.executionData) {
            executionData = job.executionData;
        }

        if (!executionData) {
            throw new Error(`Missing analysis execution data for job ${job.jobId}`);
        }

        return {
            ...executionData,
            teamId: executionData.teamId ?? job.teamId
        };
    }

    private buildOutputsMap(
        executionData: ResolvedAnalysisJobExecutionData,
        forEachItem: AnalysisOutput | undefined,
        forEachIndex: number,
        dumpLocalPath: string,
        outputDir: string
    ): Map<string, AnalysisOutput> {
        const outputs = new Map<string, AnalysisOutput>();

        for (const [nodeId, nodeOutput] of Object.entries(executionData.nodeOutputSnapshots)) {
            outputs.set(nodeId, { ...nodeOutput } as AnalysisOutput);
        }

        if (executionData.forEachNodeId) {
            const currentValue = forEachItem
                ? {
                    ...forEachItem,
                    path: dumpLocalPath
                }
                : { path: dumpLocalPath };
            const previousForEachOutput = outputs.get(executionData.forEachNodeId);

            outputs.set(executionData.forEachNodeId, previousForEachOutput
                ? {
                    ...previousForEachOutput,
                    currentValue,
                    currentIndex: forEachIndex,
                    outputPath: outputDir
                }
                : {
                    currentValue,
                    currentIndex: forEachIndex,
                    outputPath: outputDir
                });
        }

        return outputs;
    }

    private buildBatchOutputsMap(
        executionData: ResolvedAnalysisJobExecutionData,
        allDumpLocalPaths: string[],
        outputDir: string
    ): Map<string, AnalysisOutput> {
        const outputs = new Map<string, AnalysisOutput>();
        const dumpTargets = this.createDumpExecutionTargets(executionData, allDumpLocalPaths);

        for (const [nodeId, nodeOutput] of Object.entries(executionData.nodeOutputSnapshots)) {
            outputs.set(nodeId, { ...nodeOutput } as AnalysisOutput);
        }

        const contextNodeId = executionData.contextNodeId;
        if (contextNodeId) {
            const contextOutput = outputs.get(contextNodeId);
            const trajectoryDumps = dumpTargets.map((dumpTarget) => this.createTrajectoryDumpOutput(dumpTarget));
            const nextContextOutput = this.createBatchContextOutput(contextOutput, trajectoryDumps, dumpTargets, outputDir);

            outputs.set(contextNodeId, contextOutput
                ? {
                    ...contextOutput,
                    ...nextContextOutput
                }
                : nextContextOutput);
        }

        return outputs;
    }

    private createTrajectoryDumpOutput(dumpTarget: InlineWorkflowDumpTarget): AnalysisOutput {
        return {
            timestep: dumpTarget.timestep,
            natoms: dumpTarget.natoms,
            simulationCell: dumpTarget.simulationCell,
            path: dumpTarget.localPath,
            originalPath: dumpTarget.originalPath
        };
    }

    private createBatchContextOutput(
        contextOutput: AnalysisOutput | undefined,
        trajectoryDumps: AnalysisOutput[],
        dumpTargets: InlineWorkflowDumpTarget[],
        outputDir: string
    ): AnalysisOutput {
        return {
            trajectory_dumps: trajectoryDumps,
            trajectory: Object.assign({}, contextOutput?.trajectory, { frames: trajectoryDumps }),
            allDumpLocalPaths: JSON.stringify(dumpTargets.map((dumpTarget) => dumpTarget.localPath)),
            outputPath: outputDir
        };
    }

    private async executeRuntimeWorkflow(params: ExecuteRuntimeWorkflowParams): Promise<void> {
        const workflow = new WorkflowGraph(params.executionData.workflow);
        const firstDumpTarget = params.dumpTargets[0];
        if (!firstDumpTarget) {
            throw new Error(`Missing dump target for analysis ${params.executionData.analysisId}`);
        }
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
            teamId: params.executionData.teamId,
            selectedTimestep: firstDumpTarget.timestep,
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

    private async executeRuntimeNode(params: ExecuteRuntimeNodeParams): Promise<void> {
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
                if (!isWorkflowRuntimeNodeReady(params.workflow, childNode.id, params.outputs, params.visitedNodeIds)) {
                    continue;
                }

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
            for (const childNode of params.workflow.getChildren(params.node.id)) {
                if (!isWorkflowRuntimeNodeReady(params.workflow, childNode.id, params.outputs, params.visitedNodeIds)) {
                    continue;
                }

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
            for (const childNode of params.workflow.getChildren(params.node.id)) {
                if (!isWorkflowRuntimeNodeReady(params.workflow, childNode.id, params.outputs, params.visitedNodeIds)) {
                    continue;
                }

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

        const output = await this.workflowNodeRegistry.execute(params.node, params.runtimeContext) as AnalysisOutput;
        params.outputs.set(params.node.id, output);

        if (params.node.type === WorkflowNodeType.IfStatement) {
            const childNodes = resolveWorkflowRuntimeChildNodeIds(params.workflow, params.node, output).activeNodeIds.flatMap((childNodeId) => {
                const childNode = params.workflow.nodes.find((candidate) => candidate.id === childNodeId);
                return childNode ? [childNode] : [];
            });

            for (const childNode of childNodes) {
                if (!isWorkflowRuntimeNodeReady(params.workflow, childNode.id, params.outputs, params.visitedNodeIds)) {
                    continue;
                }

                await this.executeRuntimeNode({
                    ...params,
                    node: childNode,
                    executionPath: [...params.executionPath, childNode.id]
                });
            }
            return;
        }

        if (params.node.type === WorkflowNodeType.SwitchStatement) {
            const childNodes = resolveWorkflowRuntimeChildNodeIds(params.workflow, params.node, output).activeNodeIds.flatMap((childNodeId) => {
                const childNode = params.workflow.nodes.find((candidate) => candidate.id === childNodeId);
                return childNode ? [childNode] : [];
            });

            for (const childNode of childNodes) {
                if (!isWorkflowRuntimeNodeReady(params.workflow, childNode.id, params.outputs, params.visitedNodeIds)) {
                    continue;
                }

                await this.executeRuntimeNode({
                    ...params,
                    node: childNode,
                    executionPath: [...params.executionPath, childNode.id]
                });
            }
            return;
        }

        for (const childNode of params.workflow.getChildren(params.node.id)) {
            if (!isWorkflowRuntimeNodeReady(params.workflow, childNode.id, params.outputs, params.visitedNodeIds)) {
                continue;
            }

            await this.executeRuntimeNode({
                ...params,
                node: childNode,
                executionPath: [...params.executionPath, childNode.id]
            });
        }
    }

    private async executePluginNodeForRuntime(params: ExecutePluginNodeParams): Promise<AnalysisOutput> {
        if (!params.dumpTargets.length) {
            return createNestedExecutionResult([]);
        }

        if (params.isBatchMode && params.dumpTargets.length > 1) {
            const perDumpOutputs = params.dumpTargets.map(() => {
                const clonedOutputs = new Map<string, AnalysisOutput>();
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
                        teamId: params.executionData.teamId,
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

                    return (execution.output as WorkflowExecutionResultOutput).execution_result.exposures.items;
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
            teamId: params.executionData.teamId,
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

    private executeEntrypointNodeForRuntime(params: ExecuteEntrypointNodeParams): Promise<AnalysisOutput> {
        const entrypointData = params.node.data.entrypoint;
        const binaryObjectPath = entrypointData?.binaryObjectPath ?? params.executionData.binaryObjectPath;
        const argumentsTemplate = entrypointData?.arguments ?? params.executionData.arguments;
        const entrypointType = entrypointData?.type ?? params.executionData.entrypointType ?? EntrypointType.Executable;
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

    private async executeExposureNodeForRuntime(params: ExecuteExposureNodeParams): Promise<void> {
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
            params.executionData.teamId,
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
        executionData: ResolvedAnalysisJobExecutionData,
        dumpLocalPaths: string[],
        fallbackTimestep?: number
    ): InlineWorkflowDumpTarget[] {
        const batchTrajectoryDumps = executionData.batchTrajectoryDumps;
        const allDumpUrls = executionData.allDumpUrls;
        const batchDumpMetadataByPath = new Map<string, NonNullable<typeof batchTrajectoryDumps>[number]>();
        if (batchTrajectoryDumps) {
            for (const dump of batchTrajectoryDumps) {
                batchDumpMetadataByPath.set(dump.path, dump);
            }
        }
        const frameMetadataByTimestep = new Map(
            executionData.trajectoryFrames.map((frame) => [frame.timestep, frame])
        );

        const dumpTargets: InlineWorkflowDumpTarget[] = [];

        for (const [index, localPath] of dumpLocalPaths.entries()) {
            let batchDumpMetadata = batchTrajectoryDumps?.[index];
            if (!batchDumpMetadata && allDumpUrls) {
                const dumpUrl = allDumpUrls[index];
                if (dumpUrl) {
                    batchDumpMetadata = batchDumpMetadataByPath.get(dumpUrl);
                }
            }

            let timestep = 0;
            if (batchDumpMetadata?.timestep !== undefined) {
                timestep = batchDumpMetadata.timestep;
            } else if (fallbackTimestep !== undefined) {
                timestep = fallbackTimestep;
            }

            const frameMetadata = frameMetadataByTimestep.get(timestep);
            let originalPath = batchDumpMetadata?.originalPath;
            if (!originalPath) {
                originalPath = batchDumpMetadata?.path;
            }
            if (!originalPath && allDumpUrls) {
                originalPath = allDumpUrls[index];
            }

            let natoms = 0;
            if (batchDumpMetadata?.natoms !== undefined) {
                natoms = batchDumpMetadata.natoms;
            } else if (frameMetadata?.natoms !== undefined) {
                natoms = frameMetadata.natoms;
            }

            let simulationCell = '';
            if (batchDumpMetadata?.simulationCell !== undefined) {
                simulationCell = batchDumpMetadata.simulationCell;
            } else if (frameMetadata?.simulationCell !== undefined) {
                simulationCell = frameMetadata.simulationCell;
            }

            dumpTargets.push({
                localPath,
                originalPath,
                timestep,
                natoms,
                simulationCell
            });
        }

        return dumpTargets;
    }

    private resolveJobFailureReason(error: string | undefined): string {
        if (error !== undefined) {
            return error;
        }

        throw new Error('Missing failure reason for failed analysis job');
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

        if (!ownerClusterId) {
            throw new Error(`No storage owner cluster available for dump ${normalizedObjectKey}`);
        }

        const response = await this.objectStore.getStream(
            ownerClusterId,
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
            const siblingPaths = await fg(`${fg.escapePath(baseName)}_*`, {
                cwd: parentDir,
                absolute: true,
                onlyFiles: false,
                dot: true,
                unique: true
            });
            for (const siblingPath of siblingPaths) {
                tasks.push(fs.rm(siblingPath, { recursive: true, force: true }).catch(() => {}));
            }
        } catch {
        }

        await Promise.all(tasks);
    }

    private async cleanupDumpPaths(dumpPaths: string[]): Promise<void> {
        await Promise.all(dumpPaths.map((dumpPath) => fs.rm(dumpPath, { force: true }).catch(() => {})));
    }

};
