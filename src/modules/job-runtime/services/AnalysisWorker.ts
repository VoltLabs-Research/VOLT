import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { isMemoryPressured, forceGC } from '@/core/memory';
import { ANALYSIS_QUEUE_NAME } from '@/modules/platform/services';
import { MinioService } from '@/modules/platform/services';
import { RedisConnectionService } from '@/modules/platform/services';
import { QueueService } from '@/modules/platform/services';
import type { BinaryExecutorService } from './BinaryExecutorService';
import type { DaemonJobReporterService } from '@/modules/cloud-control/services';
import type { PluginBinaryCacheService } from './PluginBinaryCacheService';
import type { ResultProcessorService } from '@/modules/artifacts/services';
import { decodeCliArgumentsToken, stringifyUnknown } from '@/shared/utils';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import type { AnalysisJobExecutionData, AnalysisQueueJobPayload } from '@/shared/contracts';
import { DelayedError, type Job as BullMQJob, type Worker } from 'bullmq';
import type { Readable } from 'node:stream';
import { isRecord } from '@/shared/utils';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/workflow-runtime/contracts';
import { createWorkflowNodeRegistry } from '@/modules/workflow-runtime/factories';
import type { WorkflowNodeRegistry } from '@/modules/workflow-runtime/services';
const DUMPS_BUCKET = 'volt-dumps';

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
    executionData: AnalysisJobExecutionData;
};

interface PluginNodeConfig {
    pluginId?: string;
};

interface DumpExecutionTarget {
    localPath: string;
    originalPath?: string;
    timestep: number;
    natoms: number;
    simulationCell: string;
}

interface InlineExposureArtifact {
    exposureId: string;
    name: string;
    results: string;
    filePath: string;
}


const resolveTemplate = (template: string, outputs: Map<string, Record<string, unknown>>): string => {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref: string) => {
        const parts = ref.trim().split('.');
        const nodeId = parts[0];
        const propertyPath = parts.slice(1);
        const nodeOutput = outputs.get(nodeId);

        if (!nodeOutput) {
            logger.warn(`Template resolution failed: node "${nodeId}" not found in outputs`);
            return '';
        }

        if (propertyPath.length === 0) {
            return stringifyUnknown(nodeOutput);
        }

        let current: unknown = nodeOutput;
        for (const key of propertyPath) {
            if (!isRecord(current)) {
                return '';
            }
            current = current[key];
        }

        return current !== undefined ? stringifyUnknown(current) : '';
    });
};

const parseArguments = (value: string): string[] => {
    if (!value) {
        return [];
    }

    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
    const tokens = [...value.matchAll(regex)].map((match) => match[1] ?? match[2] ?? match[3]);

    return tokens.flatMap((token) => {
        const encodedArguments = decodeCliArgumentsToken(token);
        return encodedArguments ?? [token];
    });
};

const createRuntimeWorkflowRegistry = (): WorkflowNodeRegistry => {
    return createWorkflowNodeRegistry();
};

const getSingleAdjacentNodeId = (
    adjacencyMap: Map<string, string[]>,
    nodeId: string,
    errorMessage: string
): string | undefined => {
    const adjacentNodeIds = adjacencyMap.get(nodeId) ?? [];
    if (adjacentNodeIds.length > 1) {
        throw new Error(errorMessage);
    }

    return adjacentNodeIds[0];
};

const inferTimestepFromDumpPath = (dumpPath: string | undefined): number => {
    if (!dumpPath) {
        return 0;
    }

    const match = dumpPath.match(/timestep-(\d+)\.dump(?:\.gz)?$/);
    if (!match) {
        return 0;
    }

    const timestep = Number(match[1]);
    return Number.isFinite(timestep) ? timestep : 0;
};

const createNestedExecutionResult = (items: InlineExposureArtifact[]): Record<string, unknown> => ({
    execution_result: {
        exposures: {
            items,
            str_json: JSON.stringify(items)
        }
    }
});

const readNestedExposureItems = (output: Record<string, unknown>): InlineExposureArtifact[] => {
    const executionResult = isRecord(output.execution_result) ? output.execution_result : undefined;
    const exposures = executionResult && isRecord(executionResult.exposures)
        ? executionResult.exposures
        : undefined;
    const items = exposures?.items;

    return Array.isArray(items)
        ? items.filter((item): item is InlineExposureArtifact => isRecord(item)
            && typeof item.exposureId === 'string'
            && typeof item.name === 'string'
            && typeof item.results === 'string'
            && typeof item.filePath === 'string')
        : [];
};

export const resolveInlinePluginExecutionOrder = (
    workflow: AnalysisJobExecutionData['workflow']
): Array<AnalysisJobExecutionData['workflow']['nodes'][number]> => {
    const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
    const totalPluginNodes = workflow.nodes.filter((node) => node.type === WorkflowNodeType.Plugin).length;
    const parentMap = new Map<string, string[]>();
    const childMap = new Map<string, string[]>();

    for (const edge of workflow.edges) {
        const parents = parentMap.get(edge.target) ?? [];
        parents.push(edge.source);
        parentMap.set(edge.target, parents);

        const children = childMap.get(edge.source) ?? [];
        children.push(edge.target);
        childMap.set(edge.source, children);
    }

    const entrypointNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
    if (!entrypointNode) {
        throw new Error('Workflow entrypoint is missing');
    }

    let currentNodeId = getSingleAdjacentNodeId(
        parentMap,
        entrypointNode.id,
        `Top-level entrypoint ${entrypointNode.id} must have a single upstream chain`
    );
    const pluginNodes: Array<AnalysisJobExecutionData['workflow']['nodes'][number]> = [];

    while (currentNodeId) {
        const currentNode = nodeMap.get(currentNodeId);
        if (!currentNode) {
            throw new Error(`Workflow node ${currentNodeId} is missing from the inline plugin chain`);
        }

        if (currentNode.type === WorkflowNodeType.ForEach || currentNode.type === WorkflowNodeType.Context) {
            if (pluginNodes.length !== totalPluginNodes) {
                throw new Error('Unsupported inline plugin topology outside the entrypoint chain');
            }

            return pluginNodes.reverse();
        }

        if (currentNode.type !== WorkflowNodeType.Plugin) {
            throw new Error(`Unsupported inline plugin topology at node ${currentNode.id}`);
        }

        const pluginNodeData = currentNode.data.pluginNode as PluginNodeConfig | undefined;
        const pluginId = typeof pluginNodeData?.pluginId === 'string'
            ? pluginNodeData.pluginId.trim()
            : '';
        if (!pluginId) {
            throw new Error(`Plugin node ${currentNode.id} is missing pluginId`);
        }

        getSingleAdjacentNodeId(
            childMap,
            currentNode.id,
            `Plugin node ${currentNode.id} must have a single downstream chain`
        );
        pluginNodes.push(currentNode);
        currentNodeId = getSingleAdjacentNodeId(
            parentMap,
            currentNode.id,
            `Plugin node ${currentNode.id} must have a single upstream chain`
        );
    }

    if (pluginNodes.length !== totalPluginNodes) {
        throw new Error('Unsupported inline plugin topology outside the entrypoint chain');
    }

    throw new Error('Inline plugin chain must originate from the top-level forEach or context node');
};

export const collectInlineExposureArtifacts = async (
    workflow: AnalysisJobExecutionData['workflow'],
    outputDir: string
): Promise<InlineExposureArtifact[]> => {
    const artifacts: InlineExposureArtifact[] = [];

    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.Exposure) {
            continue;
        }

        const exposureData = node.data.exposure as Record<string, unknown> | undefined;
        const results = typeof exposureData?.results === 'string' ? exposureData.results : '';
        if (!results) {
            continue;
        }

        const filePath = `${outputDir}_${results}`;
        try {
            await fs.access(filePath);
            artifacts.push({
                exposureId: node.id,
                name: typeof exposureData?.name === 'string' ? exposureData.name : node.id,
                results,
                filePath
            });
        } catch {
        }
    }

    return artifacts;
};

export class AnalysisWorker {
    private running = false;
    private worker: Worker<QueueJobPayload> | null = null;
    private readonly workflowNodeRegistry = createRuntimeWorkflowRegistry();

    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly minioService: MinioService,
        private readonly pluginBinaryCacheService: PluginBinaryCacheService,
        private readonly binaryExecutorService: BinaryExecutorService,
        private readonly resultProcessorService: ResultProcessorService,
        private readonly daemonJobReporterService: DaemonJobReporterService
    ) {
    }

    start(concurrency?: number): void {
        if (this.running) {
            return;
        }

        this.running = true;
        this.worker = this.queueService.createWorker<QueueJobPayload>(
            ANALYSIS_QUEUE_NAME,
            async (jobPayload, job) => this.processJob(jobPayload, job),
            { concurrency: concurrency ?? 1 }
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

        logger.info('AnalysisWorker started');
    }

    async stop(): Promise<void> {
        this.running = false;
        if (this.worker) {
            await this.worker.close();
            this.worker = null;
        }

        logger.info('AnalysisWorker stopped');
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

        const { executionData } = job;
        const metadata = job.metadata || {};
        const isBatchMode = executionData.batchMode === true;
        const forEachItem = isRecord(metadata.forEachItem) ? metadata.forEachItem : {};
        const forEachIndex = typeof metadata.forEachIndex === 'number' ? metadata.forEachIndex : 0;
        const timestep = isBatchMode ? 0 : this.resolveJobTimestep(job, metadata);
        const inputFile = typeof metadata.inputFile === 'string' ? metadata.inputFile : '';
        const runningTimestamp = new Date().toISOString();

        if (!isBatchMode && typeof timestep === 'undefined') {
            throw new Error(`Missing timestep for analysis job ${job.jobId}`);
        }

        let dumpLocalPath: string | undefined;
        let batchDumpLocalPaths: string[] | undefined;
        let outputDir: string | undefined;

        try {
            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'running',
                updatedAt: runningTimestamp,
                timestamp: runningTimestamp
            });

            // Report running status to the Volt server for real-time client visibility
            await this.daemonJobReporterService.reportAnalysisJobStatus({
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

            if (isBatchMode && Array.isArray(executionData.allDumpUrls) && executionData.allDumpUrls.length > 0) {
                // Batch mode: download ALL dump files
                batchDumpLocalPaths = [];
                for (const dumpUrl of executionData.allDumpUrls) {
                    const localPath = await this.downloadDump(dumpUrl);
                    batchDumpLocalPaths.push(localPath);
                }
                dumpLocalPath = batchDumpLocalPaths[0];
                logMemoryUsage('after-batch-dump-download', job.jobId);
            } else {
                dumpLocalPath = await this.downloadDump(inputFile);
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
                await this.executeBatchInlinePluginNodes(executionData, outputs, batchDumpLocalPaths, outputDir);
            } else {
                await this.executeInlinePluginNodes(executionData, outputs, timestep!, dumpLocalPath!, outputDir);
            }

            const resolvedArgs = resolveTemplate(executionData.arguments, outputs);
            const args = parseArguments(resolvedArgs);

            logger.info(
                {
                    jobId: job.jobId,
                    binary: path.basename(executionRuntime.artifactPath),
                    args,
                    outputDir,
                    entrypointType: executionData.entrypointType ?? 'executable'
                },
                'Executing plugin binary'
            );

            await bullJob.updateProgress(10);
            const binaryStartedAt = Date.now();
            const result = await this.binaryExecutorService.executeProcess({
                jobId: job.jobId,
                commandPath: executionRuntime.commandPath,
                args: [...executionRuntime.argsPrefix, ...args],
                cwd: outputDir,
                env: executionRuntime.env
            });
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
                    job.teamId
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

            logMemoryUsage('after-result-processing', job.jobId);
            await bullJob.updateProgress(95);

            const completedTimestamp = new Date().toISOString();
            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'completed',
                updatedAt: completedTimestamp,
                timestamp: completedTimestamp
            });

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

            const failedTimestamp = new Date().toISOString();
            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'failed',
                error: message,
                updatedAt: failedTimestamp,
                timestamp: failedTimestamp
            });
            await this.daemonJobReporterService.reportJobCompletion({
                jobId: job.jobId,
                name: job.name,
                analysisId: executionData.analysisId,
                teamId: job.teamId,
                timestep,
                success: false,
                error: message
            }).catch(() => {});

            throw error instanceof Error ? error : new Error(message);
        } finally {
            if (dumpLocalPath && outputDir) {
                const dumpPathsToClean = batchDumpLocalPaths ?? [dumpLocalPath];
                await this.cleanupBatch(dumpPathsToClean, outputDir).catch((err) => {
                    logger.warn({ jobId: job.jobId, err }, 'Post-job cleanup failed');
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

        const forEachOutput = outputs.get(executionData.forEachNodeId) || {};
        forEachOutput.currentValue = {
            ...forEachItem,
            path: dumpLocalPath
        };
        forEachOutput.currentIndex = forEachIndex;
        forEachOutput.outputPath = outputDir;
        outputs.set(executionData.forEachNodeId, forEachOutput);

        return outputs;
    }

    private buildBatchOutputsMap(
        executionData: AnalysisJobExecutionData,
        allDumpLocalPaths: string[],
        outputDir: string
    ): Map<string, Record<string, unknown>> {
        const outputs = new Map<string, Record<string, unknown>>();

        for (const [nodeId, nodeOutput] of Object.entries(executionData.nodeOutputSnapshots)) {
            outputs.set(nodeId, { ...nodeOutput });
        }

        // Inject allDumpLocalPaths and outputPath into the context node's outputs
        // so templates like {{ contextNodeId.allDumpLocalPaths }} resolve correctly
        const contextNodeId = executionData.contextNodeId;
        if (contextNodeId) {
            const contextOutput = outputs.get(contextNodeId) || {};
            contextOutput.allDumpLocalPaths = JSON.stringify(allDumpLocalPaths);
            contextOutput.outputPath = outputDir;
            outputs.set(contextNodeId, contextOutput);
        }

        return outputs;
    }

    private async executeInlinePluginNodes(
        executionData: AnalysisJobExecutionData,
        outputs: Map<string, Record<string, unknown>>,
        timestep: number,
        dumpLocalPath: string,
        outputDir: string
    ): Promise<void> {
        const pluginNodes = resolveInlinePluginExecutionOrder(executionData.workflow);
        if (!pluginNodes.length) {
            return;
        }

        const dumpTarget = this.createDumpExecutionTargets(executionData, [dumpLocalPath], timestep)[0];
        if (!dumpTarget) {
            return;
        }

        for (const pluginNode of pluginNodes) {
            const output = await this.executeNestedPluginWorkflow(
                executionData,
                pluginNode.data.pluginNode as Record<string, unknown> | undefined,
                outputs,
                dumpTarget,
                outputDir
            );
            outputs.set(pluginNode.id, output);
        }
    }

    private async executeBatchInlinePluginNodes(
        executionData: AnalysisJobExecutionData,
        outputs: Map<string, Record<string, unknown>>,
        dumpLocalPaths: string[],
        outputDir: string
    ): Promise<void> {
        const pluginNodes = resolveInlinePluginExecutionOrder(executionData.workflow);
        if (!pluginNodes.length) {
            return;
        }

        const dumpTargets = this.createDumpExecutionTargets(executionData, dumpLocalPaths);
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

            for (const [index, dumpTarget] of dumpTargets.entries()) {
                const dumpOutputs = perDumpOutputs[index];

                const output = await this.executeNestedPluginWorkflow(
                    executionData,
                    pluginNode.data.pluginNode as Record<string, unknown> | undefined,
                    dumpOutputs,
                    dumpTarget,
                    `${outputDir}_batch_${index}`
                );

                dumpOutputs.set(pluginNode.id, output);
                aggregatedArtifacts.push(...readNestedExposureItems(output));
            }

            outputs.set(pluginNode.id, createNestedExecutionResult(aggregatedArtifacts));
        }
    }

    private async executeNestedPluginWorkflow(
        executionData: AnalysisJobExecutionData,
        pluginNodeData: Record<string, unknown> | undefined,
        parentOutputs: Map<string, Record<string, unknown>>,
        dumpTarget: DumpExecutionTarget,
        parentOutputDir: string
    ): Promise<Record<string, unknown>> {
        const pluginId = typeof pluginNodeData?.pluginId === 'string' ? pluginNodeData.pluginId : '';
        if (!pluginId) {
            throw new Error('Inline plugin node is missing pluginId');
        }

        const nestedPlugin = executionData.nestedPlugins.find((candidate) => candidate.pluginId === pluginId);
        if (!nestedPlugin) {
            throw new Error(`Nested plugin workflow not found for ${pluginId}`);
        }

        const nestedOutputDir = `${parentOutputDir}_plugin_${pluginId}_${Date.now()}`;
        await fs.mkdir(nestedOutputDir, { recursive: true });
        const nestedOutputs = new Map(parentOutputs);
        const selectedTimesteps = Array.isArray(pluginNodeData?.selectedTimesteps)
            ? pluginNodeData.selectedTimesteps.filter((value): value is number => typeof value === 'number')
            : [dumpTarget.timestep];
        const nestedContext = {
            outputs: nestedOutputs,
            userConfig: isRecord(pluginNodeData?.config) ? pluginNodeData.config : {},
            runtimeArguments: {},
            trajectoryId: executionData.trajectoryId,
            trajectoryFrames: [{
                timestep: dumpTarget.timestep,
                natoms: dumpTarget.natoms,
                simulationCell: dumpTarget.simulationCell
            }],
            trajectoryDumpOverrides: [{
                timestep: dumpTarget.timestep,
                natoms: dumpTarget.natoms,
                simulationCell: dumpTarget.simulationCell,
                path: dumpTarget.localPath,
                originalPath: dumpTarget.originalPath
            }],
            analysis: { _id: executionData.analysisId, pluginDisplayName: pluginId },
            analysisId: executionData.analysisId,
            generatedFiles: [],
            pluginId,
            teamId: '',
            selectedTimestep: dumpTarget.timestep,
            selectedTimesteps,
            workflow: new WorkflowGraph(nestedPlugin.workflow),
            nestedWorkflows: new Map(executionData.nestedPlugins.map((candidate) => [candidate.pluginId, candidate.workflow]))
        };
        const nestedPluginNodes = resolveInlinePluginExecutionOrder(nestedPlugin.workflow);
        const nestedEntrypointNode = nestedPlugin.workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        if (!nestedEntrypointNode) {
            throw new Error(`Nested plugin ${pluginId} has no entrypoint`);
        }

        for (const node of nestedContext.workflow.topologicalSort()) {
            if (node.id === nestedEntrypointNode.id) {
                break;
            }

            if (node.type === WorkflowNodeType.Plugin) {
                continue;
            }

            if (node.type === WorkflowNodeType.Exposure || node.type === WorkflowNodeType.Export) {
                continue;
            }

            await this.workflowNodeRegistry.execute(node as never, nestedContext as never);

            if (node.type === WorkflowNodeType.ForEach) {
                const forEachOutput = nestedOutputs.get(node.id) || {};
                const items = Array.isArray(forEachOutput.items) ? forEachOutput.items : [];
                if (!items.length) {
                    return createNestedExecutionResult([]);
                }

                forEachOutput.currentValue = {
                    ...(isRecord(items[0]) ? items[0] : {}),
                    path: dumpTarget.localPath
                };
                forEachOutput.currentIndex = 0;
                forEachOutput.outputPath = nestedOutputDir;
                nestedOutputs.set(node.id, forEachOutput);
            }
        }

        for (const pluginNode of nestedPluginNodes) {
            const nestedOutput = await this.executeNestedPluginWorkflow(
                executionData,
                pluginNode.data.pluginNode as Record<string, unknown> | undefined,
                nestedOutputs,
                dumpTarget,
                nestedOutputDir
            );
            nestedOutputs.set(pluginNode.id, nestedOutput);
        }

        await this.executeNestedEntrypoint(
            nestedEntrypointNode.data.entrypoint as Record<string, unknown> | undefined,
            nestedOutputs,
            nestedContext,
            nestedOutputDir
        );

        const exposures = await collectInlineExposureArtifacts(nestedPlugin.workflow, nestedOutputDir);
        return createNestedExecutionResult(exposures);
    }

    private createDumpExecutionTargets(
        executionData: AnalysisJobExecutionData,
        dumpLocalPaths: string[],
        fallbackTimestep?: number
    ): DumpExecutionTarget[] {
        const allDumpUrls = Array.isArray(executionData.allDumpUrls) ? executionData.allDumpUrls : [];

        return dumpLocalPaths.map((localPath, index) => {
            const originalPath = allDumpUrls[index];
            const inferredTimestep = inferTimestepFromDumpPath(originalPath);
            const timestep = inferredTimestep || fallbackTimestep || 0;

            return {
                localPath,
                originalPath,
                timestep,
                natoms: 0,
                simulationCell: ''
            };
        });
    }

    private async executeNestedEntrypoint(
        entrypointData: Record<string, unknown> | undefined,
        outputs: Map<string, Record<string, unknown>>,
        context: {
            pluginId: string;
            analysisId: string;
        },
        outputDir: string
    ): Promise<void> {
        const binaryObjectPath = typeof entrypointData?.binaryObjectPath === 'string'
            ? entrypointData.binaryObjectPath
            : '';
        const argumentsTemplate = typeof entrypointData?.arguments === 'string'
            ? entrypointData.arguments
            : '';
        if (!binaryObjectPath || !argumentsTemplate) {
            throw new Error(`Nested plugin ${context.pluginId} has invalid entrypoint configuration`);
        }

        const executionRuntime = await this.pluginBinaryCacheService.getExecutionRuntime({
            binaryObjectPath,
            entrypointType: entrypointData?.type as never,
            requirementsFile: typeof entrypointData?.requirementsFile === 'string'
                ? entrypointData.requirementsFile
                : undefined,
            entrypointScript: typeof entrypointData?.entrypointScript === 'string' && entrypointData.entrypointScript.length > 0
                ? entrypointData.entrypointScript
                : undefined
        });
        const resolvedArgs = resolveTemplate(argumentsTemplate, outputs);
        const args = parseArguments(resolvedArgs);
        const result = await this.binaryExecutorService.executeProcess({
            jobId: `${context.analysisId}:${context.pluginId}:inline`,
            commandPath: executionRuntime.commandPath,
            args: [...executionRuntime.argsPrefix, ...args],
            cwd: outputDir,
            env: executionRuntime.env
        });

        if (result.code !== 0) {
            throw new Error(`Nested plugin ${context.pluginId} failed with code ${result.code}: ${result.stderr || result.stdout}`);
        }
    }

    private async downloadDump(objectKey: string): Promise<string> {
        if (!objectKey) {
            throw new Error('No dump file path specified in job metadata');
        }

        const normalizedObjectKey = objectKey.startsWith('/')
            ? objectKey.slice(1)
            : objectKey;

        if (!normalizedObjectKey.endsWith('.dump') && !normalizedObjectKey.endsWith('.dump.gz')) {
            throw new Error(`Invalid dump object key received: ${objectKey}`);
        }

        const fileName = path.basename(normalizedObjectKey);
        const localFileName = fileName.endsWith('.gz')
            ? fileName.slice(0, -3)
            : fileName;
        const localPath = path.join(DAEMON_PATHS.analysisDumps, `${localFileName}-${Date.now()}`);
        await fs.mkdir(path.dirname(localPath), { recursive: true });

        const stream = await this.minioService.getObjectStream(DUMPS_BUCKET, normalizedObjectKey);
        await this.writeStreamToFile(stream, localPath, normalizedObjectKey.endsWith('.gz'));

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

    private async writeStreamToFile(stream: Readable, filePath: string, decompressGzip: boolean): Promise<void> {
        const { pipeline } = await import('node:stream/promises');
        const { createWriteStream } = await import('node:fs');

        if (decompressGzip) {
            await pipeline(stream, zlib.createGunzip(), createWriteStream(filePath));
        } else {
            await pipeline(stream, createWriteStream(filePath));
        }
    }
};
