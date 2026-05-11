import { TTLCache } from '@isaacs/ttlcache';
import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type {
    ExecutionLogSegmentMetadata,
    ProcessExecutionLogSink
} from '@/core/runtime/contracts/execution-log';
import type { BinaryExecutorService } from '@/core/runtime/infrastructure/binary-executor-service';
import {
    createDebugExecutionLogSink
} from '@/core/runtime/infrastructure/execution-log-streaming';
import {
    inspectWorkflowExposureOutput,
    type WorkflowExposureInspectionResult
} from '@/modules/analysis/application/workflow/exposure-payload-reader';
import { processExportNode } from '@/modules/plugin/application/exports/ExportNodeProcessor';
import { WorkflowNodeExecutor } from '@/modules/analysis/application/workflow/WorkflowNodeExecutor';
import { WorkflowSession, type WorkflowOutputsSnapshot } from '@/modules/analysis/application/workflow/WorkflowSession';
import { createDebugArtifactBatch } from '@/modules/analysis/application/workflow/debug/debug-artifact-batch';
import { safeRemovePath } from '@/support/fs/safe-remove-path';
import type { DebugEnvironmentState } from '@/modules/analysis/application/workflow/debug/DebugEnvironment';
import { WorkflowRuntime } from '@/modules/analysis/application/workflow/WorkflowRuntime';
import { WorkflowScheduler, type WorkflowExecutionStatus } from '@/modules/analysis/application/workflow/WorkflowScheduler';
import type { ReverseChannelCommandPayloadView } from '@/core/reverse-channel/contracts/reverse-channel-messaging';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import ApplicationError from '@/app/coordination/ApplicationError';
import type {
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput
} from '@/modules/analysis/contracts/workflow.types';
import type { PluginBinaryCache } from '@/modules/plugin/application/binaries/PluginBinaryCache';
import fg from 'fast-glob';
import path from 'node:path';

interface DebugExecutionLogReporter {
    reportDebugLogChunk(
        input: import('@/modules/analysis/contracts/reverse-channel-analysis').DebugLogChunkPayload
    ): Promise<void>;
}

interface DebugSessionRequest {
    workflow: import('@/modules/analysis/contracts/http-workflow').WorkflowDefinition;
    nestedPlugins: import('@/modules/analysis/contracts/http-workflow').NestedPluginDefinition[];
    trajectoryId: string;
    trajectoryFrames: import('@/modules/analysis/contracts/http-workflow').TrajectoryFrame[];
    pluginId: string;
    teamId: string;
    userConfig: ReverseChannelCommandPayloadView;
    storageClusterId: string;
    timestep?: number;
};

interface DebugNodeResult {
    nodeId: string;
    nodeType: string;
    status: 'completed' | 'skipped' | 'error';
    output?: import('@/modules/analysis/contracts/workflow.types').WorkflowNodeOutput;
    error?: string;
    stack?: string;
    reason?: string;
    nestedTrace?: import('@/modules/analysis/application/workflow/WorkflowRuntime').InlineWorkflowTraceNode[];
    durationMs: number;
    contextSnapshot: WorkflowOutputsSnapshot;
};

interface DebugSessionInfo {
    sessionId: string;
    executionOrder: DebugExecutionOrderItem[];
    forEachNodeId: string | null;
    totalIterations: number;
};

interface DebugExecutionOrderItem {
    nodeId: string;
    type: string;
}

interface DebugSession {
    sessionId: string;
    context: import('@/modules/analysis/contracts/workflow.types').WorkflowExecutionContext;
    executableNodes: import('@/modules/analysis/contracts/workflow.types').WorkflowNode[];
    nodeById: Map<string, import('@/modules/analysis/contracts/workflow.types').WorkflowNode>;
    pendingNodeIds: string[];
    scheduledNodeIds: Set<string>;
    completedNodeIds: Set<string>;
    nodeStatuses: Map<string, 'executed' | 'skipped' | 'error'>;
    forEachNodeId: string | null;
    storageClusterId: string;
    nestedPlugins: import('@/modules/analysis/contracts/http-workflow').NestedPluginDefinition[];
    preparedExecution: DebugEnvironmentState | null;
    exposureCache: Map<string, WorkflowExposureInspectionResult>;
    exposuresByNodeId: Map<string, import('@/modules/analysis/contracts/http-analysis').AnalysisExposureDefinition>;
    exportNodeToExposureNodeId: Map<string, string>;
    cleanupPaths: string[];
    cleanupDirectories: string[];
}

interface ExecutedNodeExecutionOutcome {
    status: 'executed';
    output: import('@/modules/analysis/contracts/workflow.types').WorkflowNodeOutput;
    nestedTrace?: import('@/modules/analysis/application/workflow/WorkflowRuntime').InlineWorkflowTraceNode[];
}

interface SkippedNodeExecutionOutcome {
    status: 'skipped';
    reason: string;
    nestedTrace?: import('@/modules/analysis/application/workflow/WorkflowRuntime').InlineWorkflowTraceNode[];
}

type NodeExecutionOutcome = ExecutedNodeExecutionOutcome | SkippedNodeExecutionOutcome;

interface CurrentDebugNodeInfo {
    nodeId: string;
    nodeType: string;
    index: number;
    total: number;
}

const SESSION_IDLE_TTL_MS = 5 * 60 * 1000;

let sessionCounter = 0;

const extractWorkflowTraceFromError = (error: unknown): DebugNodeResult['nestedTrace'] => {
    if (!(error instanceof ApplicationError) || error.code !== 'Workflow::Trace') {
        return undefined;
    }
    if (typeof error.details !== 'object' || error.details === null) {
        return undefined;
    }
    const trace = (error.details as { trace?: unknown }).trace;
    return Array.isArray(trace) ? trace as DebugNodeResult['nestedTrace'] : undefined;
};

@Service('debugSessionManager')
export class DebugSessionManager {
    private readonly sessions = new TTLCache<string, DebugSession>({
        ttl: SESSION_IDLE_TTL_MS,
        updateAgeOnGet: true,
        checkAgeOnGet: true,
        checkAgeOnHas: true,
        dispose: (session, sessionId, reason) => {
            if (reason === 'stale') {
                logger.warn(`@debug-session-manager: session ${sessionId} expired (idle TTL)`);
            }

            void this.cleanupSessionArtifacts(session).catch((error) => {
                logger.warn(
                    {
                        err: error,
                        sessionId
                    },
                    '@debug-session-manager: failed to cleanup debug session artifacts'
                );
            });
        }
    });
    private executionLogReporter: DebugExecutionLogReporter | null = null;
    private readonly nodeExecutor: WorkflowNodeExecutor;

    constructor(
        workflowNodeRegistry: import('@/modules/analysis/application/workflow/NodeRegistry').WorkflowNodeRegistry,
        private readonly debugEnvironment: import('@/modules/analysis/application/workflow/debug/DebugEnvironment').DebugEnvironment,
        private readonly workflowRuntime: WorkflowRuntime,
        private readonly pluginBinaryCache: PluginBinaryCache,
        private readonly binaryExecutorService: BinaryExecutorService
    ) {
        this.nodeExecutor = new WorkflowNodeExecutor(workflowNodeRegistry);
    }

    createSession(request: DebugSessionRequest): DebugSessionInfo {
        const {
            workflow: workflowDefinition,
            storageClusterId,
            timestep: selectedTimestep,
            ...sessionParams
        } = request;
        const sessionId = `dbg_${Date.now()}_${++sessionCounter}`;
        const workflow = new WorkflowGraph(workflowDefinition);
        const executableNodes = workflow.topologicalSort();
        const nodeById = new Map(executableNodes.map((node) => [node.id, node]));
        const rootNodeIds = workflow.getRootNodeIds();

        const stubAnalysis: import('@/modules/analysis/contracts/http-analysis').DaemonAnalysisDocument = {
            _id: `debug_${sessionId}`,
            pluginDisplayName: 'Debug Session'
        };

        const hasSelectedTimestep = selectedTimestep !== undefined;
        const context = WorkflowSession.create({
            ...sessionParams,
            runtimeArguments: {},
            analysis: stubAnalysis,
            analysisId: `debug_${sessionId}`,
            selectedFrameOnly: hasSelectedTimestep,
            selectedTimesteps: hasSelectedTimestep ? [selectedTimestep] : undefined,
            selectedTimestep,
            workflow
        }).context;

        const { exposuresByNodeId, exportNodeToExposureNodeId } = WorkflowSession.buildExposureMaps(workflowDefinition);
        const forEachNode = executableNodes.find((node) => node.type === WorkflowNodeType.ForEach);
        let totalIterations = 0;
        if (forEachNode) {
            totalIterations = hasSelectedTimestep
                ? 1
                : sessionParams.trajectoryFrames.length;
        }

        const session: DebugSession = {
            sessionId,
            context,
            executableNodes,
            nodeById,
            pendingNodeIds: [...rootNodeIds].reverse(),
            scheduledNodeIds: new Set(rootNodeIds),
            completedNodeIds: new Set(),
            nodeStatuses: new Map(),
            forEachNodeId: forEachNode ? forEachNode.id : null,
            storageClusterId,
            nestedPlugins: sessionParams.nestedPlugins,
            preparedExecution: null,
            exposureCache: new Map(),
            exposuresByNodeId,
            exportNodeToExposureNodeId,
            cleanupPaths: [],
            cleanupDirectories: []
        };

        this.sessions.set(sessionId, session);

        return {
            sessionId,
            executionOrder: executableNodes.map((node) => ({ nodeId: node.id, type: node.type })),
            forEachNodeId: session.forEachNodeId,
            totalIterations
        };
    }

    async executeCurrentNode(sessionId: string): Promise<DebugNodeResult | null> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const node = this.getNextPendingNode(session);
        if (!node) {
            return null;
        }
        const startTime = Date.now();

        try {
            const skipReason = this.createSessionScheduler(session).getSkipReason(node);
            const result = skipReason
                ? {
                    status: 'skipped',
                    reason: skipReason
                } satisfies NodeExecutionOutcome
                : await this.executeNode(session, node);
            const durationMs = Date.now() - startTime;

            session.completedNodeIds.add(node.id);
            session.nodeStatuses.set(node.id, result && result.status === 'skipped' ? 'skipped' : 'executed');
            const nextNodeIds = this.resolveNextNodeIds(session, node, result);
            this.enqueueNodeIds(session, nextNodeIds);

            if (!result || result.status === 'skipped') {
                return {
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'skipped',
                    reason: result?.reason ?? `No handler registered for node type "${node.type}"`,
                    nestedTrace: result?.nestedTrace,
                    durationMs,
                    contextSnapshot: WorkflowSession.snapshotOutputs(session.context.outputs)
                };
            }

            return {
                nodeId: node.id,
                nodeType: node.type,
                status: 'completed',
                output: result.output,
                nestedTrace: result.nestedTrace,
                durationMs,
                contextSnapshot: WorkflowSession.snapshotOutputs(session.context.outputs)
            };
        } catch (error) {
            const durationMs = Date.now() - startTime;
            const message = error instanceof Error ? error.message : 'Unknown error';
            const stack = error instanceof Error ? error.stack : undefined;
            session.completedNodeIds.add(node.id);
            session.nodeStatuses.set(node.id, 'error');
            this.destroySession(sessionId);

            return {
                nodeId: node.id,
                nodeType: node.type,
                status: 'error',
                error: message,
                stack,
                nestedTrace: extractWorkflowTraceFromError(error),
                durationMs,
                contextSnapshot: WorkflowSession.snapshotOutputs(session.context.outputs)
            };
        }
    }

    async executeAllRemaining(sessionId: string): Promise<DebugNodeResult[]> {
        const results: DebugNodeResult[] = [];

        while (this.sessions.has(sessionId)) {
            const result = await this.executeCurrentNode(sessionId);
            if (!result) {
                break;
            }

            results.push(result);

            if (result.status === 'error') {
                break;
            }
        }

        return results;
    }

    hasMoreNodes(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        return this.getNextPendingNode(session) !== null;
    }

    getCurrentNodeInfo(sessionId: string): CurrentDebugNodeInfo | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const node = this.getNextPendingNode(session);
        if (!node) {
            return null;
        }

        return {
            nodeId: node.id,
            nodeType: node.type,
            index: session.completedNodeIds.size,
            total: session.executableNodes.length
        };
    }

    destroySession(sessionId: string): void {
        this.sessions.delete(sessionId);
    }

    shutdown(): void {
        for (const sessionId of Array.from(this.sessions.keys())) {
            this.destroySession(sessionId);
        }
    }

    private async executeNode(
        session: DebugSession,
        node: WorkflowNode
    ): Promise<NodeExecutionOutcome | null> {
        switch (node.type) {
            case WorkflowNodeType.Plugin:
                return this.executePluginNode(session, node);
            case WorkflowNodeType.Export:
                return this.executeExportNode(session, node);
            case WorkflowNodeType.Arguments:
            default: {
                const result = await this.nodeExecutor.executeNode(
                    node,
                    await this.createNodeExecutionContext(session, node)
                );
                if (result.status === 'skipped') {
                    return {
                        status: 'skipped',
                        reason: result.reason!
                    };
                }

                const output = result.output!;
                if (output.skipped === true && typeof output.reason === 'string') {
                    return {
                        status: 'skipped',
                        reason: output.reason
                    };
                }

                return {
                    status: 'executed',
                    output
                };
            }
        }
    }

    private getNextPendingNode(session: DebugSession): WorkflowNode | null {
        while (session.pendingNodeIds.length > 0) {
            const nodeId = session.pendingNodeIds[session.pendingNodeIds.length - 1];
            if (session.completedNodeIds.has(nodeId)) {
                session.pendingNodeIds.pop();
                continue;
            }

            return session.nodeById.get(nodeId)!;
        }

        return null;
    }

    private enqueueNodeIds(session: DebugSession, nodeIds: string[]): void {
        const scheduler = this.createSessionScheduler(session);

        for (let index = nodeIds.length - 1; index >= 0; index -= 1) {
            const nodeId = nodeIds[index];
            if (!nodeId || session.completedNodeIds.has(nodeId) || session.scheduledNodeIds.has(nodeId)) {
                continue;
            }

            const isReady = scheduler.areParentEdgesResolved(nodeId);
            if (!isReady) {
                continue;
            }

            session.pendingNodeIds.push(nodeId);
            session.scheduledNodeIds.add(nodeId);
        }
    }

    private resolveNextNodeIds(
        session: DebugSession,
        node: WorkflowNode,
        result: NodeExecutionOutcome | null
    ): string[] {
        if (!result || result.status === 'skipped') {
            return session.context.workflow.getChildNodeIds(node.id);
        }

        const { activeNodeIds, inactiveNodeIds } = this.createSessionScheduler(session)
            .resolveChildNodeIds(node, result.output!);

        return [...activeNodeIds, ...inactiveNodeIds];
    }

    private getWorkflowExecutionStatus(
        session: DebugSession,
        nodeId: string
    ): WorkflowExecutionStatus {
        const status = session.nodeStatuses.get(nodeId);
        if (status === 'executed') {
            return 'executed';
        }

        if (status === 'error') {
            return 'failed';
        }

        if (status === 'skipped') {
            return 'skipped';
        }

        return 'pending';
    }

    private async executePluginNode(
        session: DebugSession,
        node: WorkflowNode
    ): Promise<NodeExecutionOutcome> {
        const preparedExecution = await this.ensurePreparedExecutionEnvironment(session);
        const execution = await this.workflowRuntime.executePluginNode({
            node,
            workflow: session.context.workflow.definition,
            nestedPlugins: session.nestedPlugins,
            outputs: session.context.outputs,
            dumpTarget: {
                localPath: preparedExecution.dumpPath,
                originalPath: preparedExecution.selectedDump.originalPath ?? preparedExecution.selectedDump.path,
                timestep: preparedExecution.selectedDump.timestep,
                natoms: preparedExecution.selectedDump.natoms,
                simulationCell: preparedExecution.selectedDump.simulationCell
            },
            outputDir: preparedExecution.outputDir,
            trajectoryId: session.context.trajectoryId,
            trajectoryFrames: session.context.trajectoryFrames,
            analysisId: session.context.analysisId,
            analysis: session.context.analysis,
            teamId: session.context.teamId,
            rootNodeId: node.id,
            executionPath: [node.id],
            captureTrace: true,
            logSinkFactory: (context) => this.createDebugLogSink(
                session.sessionId,
                node.id,
                {
                    nodeId: context.nodeId,
                    nodeType: context.nodeType,
                    pluginId: context.pluginId,
                    executionPath: context.executionPath
                }
            )
        });

        session.context.outputs.set(node.id, execution.output);
        return {
            status: 'executed',
            output: execution.output,
            nestedTrace: execution.trace
        };
    }

    private createSessionScheduler(session: DebugSession): WorkflowScheduler {
        return new WorkflowScheduler({
            workflow: session.context.workflow,
            outputs: session.context.outputs,
            getNodeExecutionStatus: (nodeId) => this.getWorkflowExecutionStatus(session, nodeId)
        });
    }

    private createDebugLogSink(
        sessionId: string,
        nodeId: string,
        metadata: ExecutionLogSegmentMetadata
    ): ProcessExecutionLogSink | undefined {
        if (!this.executionLogReporter) {
            return undefined;
        }

        return createDebugExecutionLogSink({
            reporter: this.executionLogReporter,
            sessionId,
            nodeId,
            metadata
        });
    }

    private async createNodeExecutionContext(
        session: DebugSession,
        node: WorkflowNode
    ): Promise<WorkflowExecutionContext> {
        if (node.type !== WorkflowNodeType.Entrypoint && node.type !== WorkflowNodeType.Exposure) {
            return session.context;
        }

        const preparedExecution = await this.ensurePreparedExecutionEnvironment(session);
        const baseExecution = session.context.execution;
        const nextExecution = {
            ...baseExecution
        };

        if (node.type === WorkflowNodeType.Entrypoint) {
            nextExecution.entrypoint = {
                ...baseExecution?.entrypoint,
                jobId: `debug:${node.id}:${Date.now()}`,
                outputDir: preparedExecution.outputDir,
                pluginBinaryCache: this.pluginBinaryCache,
                binaryExecutorService: this.binaryExecutorService,
                logSink: this.createDebugLogSink(
                    session.sessionId,
                    node.id,
                    {
                        nodeId: node.id,
                        nodeType: node.type,
                        pluginId: session.context.pluginId,
                        executionPath: [node.id]
                    }
                ),
                restoreOutputOnError: true,
                includeOutputFiles: true,
                nonZeroExitMessage: (result) => `Entrypoint exited with code ${result.code}: ${result.stderr || result.stdout}`,
                extraOutput: {
                    dumpPath: preparedExecution.dumpPath
                },
                errorMessage: `Entrypoint ${node.id} is missing runtime configuration`
            };
        }

        if (node.type === WorkflowNodeType.Exposure) {
            nextExecution.exposure = {
                ...baseExecution?.exposure,
                mode: 'debug',
                outputDir: preparedExecution.outputDir,
                onInspection: (nodeId, inspection) => {
                    session.exposureCache.set(nodeId, inspection);
                }
            };
        }

        return {
            ...session.context,
            execution: nextExecution
        };
    }

    private async executeExportNode(
        session: DebugSession,
        node: WorkflowNode
    ): Promise<NodeExecutionOutcome> {
        const preparedExecution = await this.ensurePreparedExecutionEnvironment(session);
        const exposureNodeId = session.exportNodeToExposureNodeId.get(node.id);
        if (!exposureNodeId) {
            return {
                status: 'skipped',
                reason: `Export node ${node.id} is not linked to an exposure node`
            };
        }

        const exposure = session.exposuresByNodeId.get(exposureNodeId);
        if (!exposure?.export) {
            return {
                status: 'skipped',
                reason: `Export node ${node.id} has no valid export configuration`
            };
        }

        let inspection = session.exposureCache.get(exposureNodeId);
        if (!inspection) {
            if (!exposure.results) {
                return {
                    status: 'skipped',
                    reason: `Exposure ${exposureNodeId} has no results file configured`
                };
            }

            inspection = await inspectWorkflowExposureOutput(preparedExecution.outputDir, exposure.results);
            session.exposureCache.set(exposureNodeId, inspection);
        }

        if (!inspection.exportPayload) {
            return {
                status: 'skipped',
                reason: `Exposure ${exposureNodeId} did not produce export payload data`
            };
        }

        const exportDirectory = `${preparedExecution.outputDir}_debug_export_${node.id}_${Date.now()}`;
        const artifactBatch = createDebugArtifactBatch(exportDirectory);
        const storageClusterId = session.storageClusterId;

        await processExportNode({
            executionData: {
                analysisId: session.context.analysisId,
                trajectoryId: session.context.trajectoryId,
                pluginId: session.context.pluginId,
                storageClusterId
            },
            exposure,
            decodedPayload: inspection.exportPayload,
            timestep: session.context.selectedTimestep ?? preparedExecution.selectedDump.timestep,
            storageClusterId,
            artifactUploadBatch: artifactBatch
        });

        const artifacts = artifactBatch.getArtifacts().map((artifact) => ({
            path: artifact.path,
            objectKey: artifact.objectKey,
            bucket: artifact.bucket,
            contentType: artifact.contentType,
            fileName: artifact.fileName
        }));
        const output: WorkflowNodeOutput = {
            artifacts,
            exporter: exposure.export.exporter,
            exportType: exposure.export.type,
            sourceExposureNodeId: exposureNodeId
        };

        session.context.outputs.set(node.id, output);
        return {
            status: 'executed',
            output
        };
    }

    private async ensurePreparedExecutionEnvironment(session: DebugSession): Promise<DebugEnvironmentState> {
        if (session.preparedExecution) {
            return session.preparedExecution;
        }

        const preparedExecution = await this.debugEnvironment.prepare(
            session.sessionId,
            session.context,
            session.storageClusterId
        );
        session.preparedExecution = preparedExecution;
        session.cleanupPaths.push(preparedExecution.dumpPath);
        session.cleanupDirectories.push(preparedExecution.outputDir);

        return preparedExecution;
    }

    private async cleanupSessionArtifacts(session: DebugSession): Promise<void> {
        const cleanupDirectorySet = new Set(session.cleanupDirectories);
        const cleanupTasks = [
            ...session.cleanupPaths.map((filePath) => safeRemovePath(filePath)),
            ...Array.from(cleanupDirectorySet).map(async (directoryPath) => {
                await safeRemovePath(directoryPath, { recursive: true });

                try {
                    const parentDir = path.dirname(directoryPath);
                    const baseName = path.basename(directoryPath);
                    const siblingPaths = await fg(`${fg.escapePath(baseName)}_*`, {
                        cwd: parentDir,
                        absolute: true,
                        onlyFiles: false,
                        dot: true,
                        unique: true
                    });
                    await Promise.all(siblingPaths.map((siblingPath) => safeRemovePath(siblingPath, { recursive: true })));
                } catch {
                }
            })
        ];

        await Promise.all(cleanupTasks);
    }
}
