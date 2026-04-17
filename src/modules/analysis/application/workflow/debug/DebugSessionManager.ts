import { TTLCache } from '@isaacs/ttlcache';
import { logger } from '@/core/logger';
import { createDebugExecutionLogSink } from '@/core/runtime/infrastructure/ExecutionLogStreaming';
import { VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@/core/storage/contracts/http.objectStore';
import { buildWorkflowExposureMaps } from '@/modules/analysis/application/workflow/ExposureExportLinking';
import { createWorkflowExecutionContext, snapshotWorkflowOutputs } from '@/modules/analysis/application/workflow/WorkflowExecutionContextFactory';
import { createDebugArtifactBatch } from '@/modules/analysis/application/workflow/debug/DebugArtifactBatch';
import { inspectDebugExposureResult } from '@/modules/analysis/application/workflow/debug/DebugExposureProcessor';
import { InlineWorkflowRuntime, InlineWorkflowTraceError } from '@/modules/analysis/application/workflow/InlineWorkflowRuntime';
import { resolveWorkflowParentEdgeState, resolveWorkflowRuntimeChildNodeIds } from '@/modules/analysis/application/workflow/WorkflowRuntimeScheduling';
import { runOrderedWorkflowNodes } from '@/modules/analysis/application/workflow/OrderedNodeRunner';
import { WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import fg from 'fast-glob';
import path from 'node:path';
import fs from 'node:fs/promises';

interface DebugExecutionLogReporter {
    reportDebugLogChunk(
        input: import('@/modules/analysis/application/events/DebugLogChunkReportedEvent').DebugLogChunkReportedEventData
    ): Promise<void>;
}

interface DebugSessionRequest {
    workflow: import('@/modules/analysis/contracts/http.workflow').WorkflowDefinition;
    nestedPlugins: import('@/modules/analysis/contracts/http.workflow').NestedPluginDefinition[];
    trajectoryId: string;
    trajectoryFrames: import('@/modules/analysis/contracts/http.workflow').TrajectoryFrame[];
    pluginId: string;
    teamId: string;
    userConfig: import('@/core/reverse-channel/contracts/commandHandler').ReverseChannelCommandPayloadView;
    storageClusterId?: string;
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
    nestedTrace?: import('@/modules/analysis/application/workflow/InlineWorkflowRuntime').InlineWorkflowTraceNode[];
    durationMs: number;
    contextSnapshot: ReturnType<typeof snapshotWorkflowOutputs>;
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
    nestedPlugins: import('@/modules/analysis/contracts/http.workflow').NestedPluginDefinition[];
    preparedExecution: import('@/modules/analysis/application/workflow/debug/DebugEntrypointExecutor').PreparedDebugExecutionEnvironment | null;
    exposureCache: Map<string, import('@/modules/analysis/application/workflow/debug/DebugExposureProcessor').DebugExposureInspectionResult>;
    exposuresByNodeId: Map<string, import('@/modules/analysis/contracts/http.analysis').AnalysisExposureDefinition>;
    exportNodeToExposureNodeId: Map<string, string>;
    cleanupPaths: string[];
    cleanupDirectories: string[];
}

interface ExecutedNodeExecutionOutcome {
    status: 'executed';
    output: import('@/modules/analysis/contracts/workflow.types').WorkflowNodeOutput;
    nestedTrace?: import('@/modules/analysis/application/workflow/InlineWorkflowRuntime').InlineWorkflowTraceNode[];
}

interface SkippedNodeExecutionOutcome {
    status: 'skipped';
    reason: string;
    nestedTrace?: import('@/modules/analysis/application/workflow/InlineWorkflowRuntime').InlineWorkflowTraceNode[];
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

    constructor(
        private readonly workflowNodeRegistry: import('@/modules/analysis/application/workflow/NodeRegistry').WorkflowNodeRegistry,
        private readonly debugEntrypointExecutor: import('@/modules/analysis/application/workflow/debug/DebugEntrypointExecutor').DebugEntrypointExecutor,
        private readonly inlineWorkflowRuntime: InlineWorkflowRuntime,
        private readonly exportNodeProcessorService: import('@/modules/plugin/application/exports/ExportNodeProcessorService').ExportNodeProcessorService
    ) {}

    createSession(request: DebugSessionRequest): DebugSessionInfo {
        const sessionId = `dbg_${Date.now()}_${++sessionCounter}`;
        const workflow = new WorkflowGraph(request.workflow);
        const executableNodes = workflow.topologicalSort();
        const nodeById = new Map(executableNodes.map((node) => [node.id, node]));
        const rootNodeIds = executableNodes
            .filter((node) => !workflow.edges.some((edge) => edge.target === node.id))
            .map((node) => node.id);

        const stubAnalysis: import('@/modules/analysis/contracts/http.analysis').DaemonAnalysisDocument = {
            _id: `debug_${sessionId}`,
            pluginDisplayName: 'Debug Session'
        };

        const selectedTimestep = request.timestep;
        const hasSelectedTimestep = selectedTimestep !== undefined;
        const context = createWorkflowExecutionContext({
            userConfig: request.userConfig,
            runtimeArguments: {},
            trajectoryId: request.trajectoryId,
            trajectoryFrames: request.trajectoryFrames,
            analysis: stubAnalysis,
            analysisId: `debug_${sessionId}`,
            pluginId: request.pluginId,
            teamId: request.teamId,
            selectedFrameOnly: hasSelectedTimestep,
            selectedTimesteps: hasSelectedTimestep ? [selectedTimestep] : undefined,
            selectedTimestep,
            workflow,
            nestedPlugins: request.nestedPlugins
        });

        const { exposuresByNodeId, exportNodeToExposureNodeId } = buildWorkflowExposureMaps(request.workflow);
        const forEachNode = executableNodes.find((node) => node.type === WorkflowNodeType.ForEach);
        let totalIterations = 0;
        if (forEachNode) {
            totalIterations = hasSelectedTimestep
                ? 1
                : request.trajectoryFrames.length;
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
            storageClusterId: request.storageClusterId ?? VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
            nestedPlugins: request.nestedPlugins,
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
            const skipReason = this.getNodeSkipReason(session, node);
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
                    contextSnapshot: snapshotWorkflowOutputs(session.context.outputs)
                };
            }

            return {
                nodeId: node.id,
                nodeType: node.type,
                status: 'completed',
                output: result.output,
                nestedTrace: result.nestedTrace,
                durationMs,
                contextSnapshot: snapshotWorkflowOutputs(session.context.outputs)
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
                nestedTrace: error instanceof InlineWorkflowTraceError ? error.trace : undefined,
                durationMs,
                contextSnapshot: snapshotWorkflowOutputs(session.context.outputs)
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
            case WorkflowNodeType.Entrypoint:
                return this.executeEntrypointNode(session, node);
            case WorkflowNodeType.Exposure:
                return this.executeExposureNode(session, node);
            case WorkflowNodeType.Export:
                return this.executeExportNode(session, node);
            case WorkflowNodeType.Arguments:
            default: {
                const [orderedResult] = await runOrderedWorkflowNodes({
                    nodes: [node],
                    context: session.context,
                    registry: this.workflowNodeRegistry
                });
                if (!orderedResult) {
                    return null;
                }

                if (orderedResult.status === 'skipped') {
                    return {
                        status: 'skipped',
                        reason: orderedResult.reason!
                    };
                }

                const output = orderedResult.output!;
                session.context.outputs.set(node.id, output);
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
        for (let index = nodeIds.length - 1; index >= 0; index -= 1) {
            const nodeId = nodeIds[index];
            if (!nodeId || session.completedNodeIds.has(nodeId) || session.scheduledNodeIds.has(nodeId)) {
                continue;
            }

            const nodeStateCache = new Map<string, WorkflowRuntimeNodeState>();
            const resolvingNodeIds = new Set<string>();
            const isReady = session.context.workflow.edges
                .filter((edge) => edge.target === nodeId)
                .every((edge) => resolveWorkflowParentEdgeState({
                    workflow: session.context.workflow,
                    outputs: session.context.outputs,
                    getNodeExecutionStatus: (currentNodeId) => this.getWorkflowExecutionStatus(session, currentNodeId),
                    edge,
                    targetNodeId: nodeId,
                    nodeStateCache,
                    resolvingNodeIds
                }).resolved);
            if (!isReady) {
                continue;
            }

            session.pendingNodeIds.push(nodeId);
            session.scheduledNodeIds.add(nodeId);
        }
    }

    private getNodeSkipReason(session: DebugSession, node: WorkflowNode): string | undefined {
        const parentEdges = session.context.workflow.edges.filter((edge) => edge.target === node.id);
        if (parentEdges.length === 0) {
            return undefined;
        }

        const nodeStateCache = new Map<string, WorkflowRuntimeNodeState>();
        const resolvingNodeIds = new Set<string>();
        let hasActiveParent = false;
        let inactiveReason: string | undefined;

        for (const parentEdge of parentEdges) {
            const parentState = resolveWorkflowParentEdgeState({
                workflow: session.context.workflow,
                outputs: session.context.outputs,
                getNodeExecutionStatus: (currentNodeId) => this.getWorkflowExecutionStatus(session, currentNodeId),
                edge: parentEdge,
                targetNodeId: node.id,
                nodeStateCache,
                resolvingNodeIds
            });
            if (!parentState.resolved) {
                return parentState.reason;
            }

            if (parentState.active) {
                if (parentState.reason) {
                    return parentState.reason;
                }

                hasActiveParent = true;
                continue;
            }

            inactiveReason ??= parentState.reason;
        }

        return hasActiveParent ? undefined : inactiveReason;
    }

    private resolveNextNodeIds(
        session: DebugSession,
        node: WorkflowNode,
        result: NodeExecutionOutcome | null
    ): string[] {
        const workflow = session.context.workflow;

        if (!result || result.status === 'skipped') {
            return workflow.getChildren(node.id).map((childNode) => childNode.id);
        }

        if (node.type === WorkflowNodeType.IfStatement || node.type === WorkflowNodeType.SwitchStatement) {
            const { activeNodeIds, inactiveNodeIds } = resolveWorkflowRuntimeChildNodeIds(
                workflow,
                node,
                result.output!
            );

            return [...activeNodeIds, ...inactiveNodeIds];
        }

        return workflow.getChildren(node.id).map((childNode) => childNode.id);
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
        const execution = await this.inlineWorkflowRuntime.executePluginNode({
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

    private async executeEntrypointNode(
        session: DebugSession,
        node: WorkflowNode
    ): Promise<NodeExecutionOutcome> {
        const preparedExecution = await this.ensurePreparedExecutionEnvironment(session);
        const execution = await this.debugEntrypointExecutor.executePrepared(
            node,
            session.context,
            preparedExecution,
            this.createDebugLogSink(
                session.sessionId,
                node.id,
                {
                    nodeId: node.id,
                    nodeType: node.type,
                    pluginId: session.context.pluginId,
                    executionPath: [node.id]
                }
            )
        );

        session.context.outputs.set(node.id, execution.output);

        return {
            status: 'executed',
            output: execution.output
        };
    }

    private async executeExposureNode(
        session: DebugSession,
        node: WorkflowNode
    ): Promise<NodeExecutionOutcome> {
        const preparedExecution = await this.ensurePreparedExecutionEnvironment(session);
        const exposure = session.exposuresByNodeId.get(node.id);
        if (!exposure || !exposure.results) {
            return {
                status: 'skipped',
                reason: `Exposure node ${node.id} has no results file configured`
            };
        }

        const inspection = await inspectDebugExposureResult(
            preparedExecution.outputDir,
            exposure.results
        );
        session.exposureCache.set(node.id, inspection);

        const output: WorkflowNodeOutput = {
            outputFilePath: inspection.outputFilePath,
            listingRowCount: inspection.listingRowCount,
            subListingNames: inspection.subListingNames,
            hasExportPayload: inspection.exportPayload !== null
        };
        const linkedExportNodeId = Array.from(session.exportNodeToExposureNodeId.entries())
            .find(([, exposureNodeId]) => exposureNodeId === node.id)?.[0];
        if (linkedExportNodeId) {
            output.linkedExportNodeId = linkedExportNodeId;
        }

        session.context.outputs.set(node.id, output);
        return {
            status: 'executed',
            output
        };
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
            inspection = await inspectDebugExposureResult(
                preparedExecution.outputDir,
                exposure.results
            );
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

        await this.exportNodeProcessorService.process({
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

    private async ensurePreparedExecutionEnvironment(session: DebugSession): Promise<PreparedDebugExecutionEnvironment> {
        if (session.preparedExecution) {
            return session.preparedExecution;
        }

        const preparedExecution = await this.debugEntrypointExecutor.prepareExecutionEnvironment(
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
            ...session.cleanupPaths.map((filePath) => fs.rm(filePath, { force: true }).catch(() => {})),
            ...Array.from(cleanupDirectorySet).map(async (directoryPath) => {
                await fs.rm(directoryPath, { recursive: true, force: true }).catch(() => {});

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
                    await Promise.all(siblingPaths.map((siblingPath) => fs.rm(siblingPath, {
                            recursive: true,
                            force: true
                        }).catch(() => {})));
                } catch {
                }
            })
        ];

        await Promise.all(cleanupTasks);
    }
}
