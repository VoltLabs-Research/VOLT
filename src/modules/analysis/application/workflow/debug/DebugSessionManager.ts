import { logger } from '@/core/logger';
import { createExportNodeProcessorService } from '@/modules/plugin/application/exports/ExportNodeProcessorService';
import { createDebugExecutionLogSink } from '@/core/runtime/infrastructure/ExecutionLogStreaming';
import type { BinaryExecutorService, ProcessExecutionLogSink } from '@/core/runtime/infrastructure/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/plugin/application/binaries/PluginBinaryCacheService';
import type { NativeModuleLoader } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import type { AnalysisExposureDefinition, DaemonAnalysisDocument, NestedPluginDefinition, TrajectoryFrame, WorkflowDefinition } from '@/contracts';
import { buildWorkflowExposureMaps } from '@/modules/analysis/application/workflow/ExposureExportLinking';
import { createWorkflowExecutionContext, snapshotWorkflowOutputs } from '@/modules/analysis/application/workflow/WorkflowExecutionContextFactory';
import { DebugEntrypointExecutor } from '@/modules/analysis/application/workflow/debug/DebugEntrypointExecutor';
import { createDebugArtifactBatch } from '@/modules/analysis/application/workflow/debug/DebugArtifactBatch';
import { inspectDebugExposureResult } from '@/modules/analysis/application/workflow/debug/DebugExposureProcessor';
import { InlineWorkflowRuntime, InlineWorkflowTraceError, type InlineWorkflowTraceNode } from '@/modules/analysis/application/workflow/InlineWorkflowRuntime';
import { readWorkflowIfBranch, resolveWorkflowRuntimeChildNodeIds } from '@/modules/analysis/application/workflow/WorkflowRuntimeScheduling';
import { runOrderedWorkflowNodes } from '@/modules/analysis/application/workflow/OrderedNodeRunner';
import { matchesIfBranchHandle, WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExportNodeProcessorService } from '@/modules/plugin/application/exports/ExportNodeProcessorService';
import type { ExecutionLogSegmentMetadata } from '@/core/runtime/infrastructure/ExecutionLogStreaming';
import type { PreparedDebugExecutionEnvironment } from '@/modules/analysis/application/workflow/debug/DebugEntrypointExecutor';
import type { DebugExposureInspectionResult } from '@/modules/analysis/application/workflow/debug/DebugExposureProcessor';
import type { WorkflowExecutionContext, WorkflowNode } from '@/modules/analysis/contracts/workflow.types';

interface DebugExecutionLogReporter {
    reportDebugLogChunk(input: {
        sessionId: string;
        nodeId: string;
        segments: import('@/contracts').TeamClusterDaemonExecutionLogSegment[];
    }): Promise<void>;
}

const SESSION_IDLE_TTL_MS = 5 * 60 * 1000;
const SESSION_SWEEP_INTERVAL_MS = 30 * 1000;

interface DebugSessionRequest {
    workflow: WorkflowDefinition;
    nestedPlugins?: NestedPluginDefinition[];
    trajectoryId: string;
    trajectoryFrames: TrajectoryFrame[];
    pluginId: string;
    teamId: string;
    userConfig: Record<string, unknown>;
    storageClusterId?: string;
    timestep?: number;
};

interface DebugNodeResult {
    nodeId: string;
    nodeType: string;
    status: 'completed' | 'skipped' | 'error';
    output?: Record<string, unknown>;
    error?: string;
    stack?: string;
    reason?: string;
    nestedTrace?: InlineWorkflowTraceNode[];
    durationMs: number;
    contextSnapshot: Record<string, Record<string, unknown>>;
};

interface DebugSessionInfo {
    sessionId: string;
    executionOrder: Array<{ nodeId: string; type: string; }>;
    forEachNodeId: string | null;
    totalIterations: number;
};

interface DebugSession {
    sessionId: string;
    context: WorkflowExecutionContext;
    executableNodes: WorkflowNode[];
    nodeById: Map<string, WorkflowNode>;
    pendingNodeIds: string[];
    scheduledNodeIds: Set<string>;
    completedNodeIds: Set<string>;
    nodeStatuses: Map<string, 'executed' | 'skipped' | 'error'>;
    lastActivity: number;
    forEachNodeId: string | null;
    storageClusterId?: string;
    nestedPlugins: NestedPluginDefinition[];
    preparedExecution: PreparedDebugExecutionEnvironment | null;
    exposureCache: Map<string, DebugExposureInspectionResult>;
    exposuresByNodeId: Map<string, AnalysisExposureDefinition>;
    exportNodeToExposureNodeId: Map<string, string>;
    cleanupPaths: string[];
    cleanupDirectories: string[];
}

let sessionCounter = 0;

const generateSessionId = (): string => {
    return `dbg_${Date.now()}_${++sessionCounter}`;
};

const buildExposureMaps = (
    workflow: WorkflowDefinition
): {
    exposuresByNodeId: Map<string, AnalysisExposureDefinition>;
    exportNodeToExposureNodeId: Map<string, string>;
} => {
    return buildWorkflowExposureMaps(workflow);
};

interface NodeExecutionOutcome {
    status: 'executed' | 'skipped';
    output?: Record<string, unknown>;
    reason?: string;
    nestedTrace?: InlineWorkflowTraceNode[];
}

export class DebugSessionManager {
    private readonly sessions = new Map<string, DebugSession>();
    private sweepTimer: ReturnType<typeof setInterval> | null = null;
    private readonly debugEntrypointExecutor: DebugEntrypointExecutor;
    private readonly inlineWorkflowRuntime: InlineWorkflowRuntime;
    private readonly exportNodeProcessorService: ExportNodeProcessorService;
    private executionLogReporter: DebugExecutionLogReporter | null = null;

    constructor(
        private readonly registry: WorkflowNodeRegistry,
        deps: {
            objectStore: ClusterObjectStore;
            pluginBinaryCacheService: PluginBinaryCacheService;
            binaryExecutorService: BinaryExecutorService;
            nativeModuleLoader: NativeModuleLoader;
        }
    ) {
        this.debugEntrypointExecutor = new DebugEntrypointExecutor(
            deps.objectStore,
            deps.pluginBinaryCacheService,
            deps.binaryExecutorService
        );
        this.inlineWorkflowRuntime = new InlineWorkflowRuntime(
            registry,
            deps.pluginBinaryCacheService,
            deps.binaryExecutorService
        );
        this.exportNodeProcessorService = createExportNodeProcessorService(deps.nativeModuleLoader);
        this.startIdleSweep();
    }

    setExecutionLogReporter(
        reporter: DebugExecutionLogReporter
    ): void {
        this.executionLogReporter = reporter;
    }

    createSession(request: DebugSessionRequest): DebugSessionInfo {
        const sessionId = generateSessionId();
        const workflow = new WorkflowGraph(request.workflow);
        const executableNodes = workflow.topologicalSort();
        const nodeById = new Map(executableNodes.map((node) => [node.id, node]));
        const rootNodeIds = executableNodes
            .filter((node) => !workflow.edges.some((edge) => edge.target === node.id))
            .map((node) => node.id);

        const stubAnalysis: DaemonAnalysisDocument = {
            _id: `debug_${sessionId}`,
            pluginDisplayName: 'Debug Session'
        };

        const context = createWorkflowExecutionContext({
            userConfig: request.userConfig,
            runtimeArguments: {},
            trajectoryId: request.trajectoryId,
            trajectoryFrames: request.trajectoryFrames,
            analysis: stubAnalysis,
            analysisId: `debug_${sessionId}`,
            pluginId: request.pluginId,
            teamId: request.teamId,
            selectedFrameOnly: typeof request.timestep === 'number',
            selectedTimesteps: typeof request.timestep === 'number' ? [request.timestep] : undefined,
            selectedTimestep: request.timestep,
            workflow,
            nestedPlugins: request.nestedPlugins ?? []
        });

        const { exposuresByNodeId, exportNodeToExposureNodeId } = buildExposureMaps(request.workflow);
        const forEachNode = executableNodes.find((node) => node.type === WorkflowNodeType.ForEach);
        const totalIterations = forEachNode
            ? (typeof request.timestep === 'number' ? 1 : request.trajectoryFrames.length)
            : 0;

        const session: DebugSession = {
            sessionId,
            context,
            executableNodes,
            nodeById,
            pendingNodeIds: [...rootNodeIds].reverse(),
            scheduledNodeIds: new Set(rootNodeIds),
            completedNodeIds: new Set(),
            nodeStatuses: new Map(),
            lastActivity: Date.now(),
            forEachNodeId: forEachNode?.id ?? null,
            storageClusterId: request.storageClusterId,
            nestedPlugins: request.nestedPlugins ?? [],
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

        session.lastActivity = Date.now();

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
            session.nodeStatuses.set(node.id, result?.status === 'skipped' ? 'skipped' : 'executed');
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
        } catch (error: unknown) {
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

        while (true) {
            const session = this.sessions.get(sessionId);
            if (!session || !this.hasMoreNodes(sessionId)) {
                break;
            }

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

    getCurrentNodeInfo(sessionId: string): { nodeId: string; nodeType: string; index: number; total: number } | null {
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
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        this.sessions.delete(sessionId);
        this.cleanupSessionArtifacts(session).catch((error: unknown) => {
            logger.warn(
                {
                    err: error,
                    sessionId
                },
                '@debug-session-manager: failed to cleanup debug session artifacts'
            );
        });
    }

    shutdown(): void {
        if (this.sweepTimer) {
            clearInterval(this.sweepTimer);
            this.sweepTimer = null;
        }

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
                    registry: this.registry
                });
                if (!orderedResult) {
                    return null;
                }

                if (orderedResult.status === 'skipped') {
                    return {
                        status: 'skipped',
                        reason: orderedResult.reason
                    };
                }

                const output = orderedResult.output ?? session.context.outputs.get(node.id) ?? {};
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

            return session.nodeById.get(nodeId) ?? null;
        }

        return null;
    }

    private enqueueNodeIds(session: DebugSession, nodeIds: string[]): void {
        for (let index = nodeIds.length - 1; index >= 0; index -= 1) {
            const nodeId = nodeIds[index];
            if (!nodeId || session.completedNodeIds.has(nodeId) || session.scheduledNodeIds.has(nodeId)) {
                continue;
            }

            if (!this.isNodeReadyToSchedule(session, nodeId)) {
                continue;
            }

            session.pendingNodeIds.push(nodeId);
            session.scheduledNodeIds.add(nodeId);
        }
    }

    private isNodeReadyToSchedule(session: DebugSession, nodeId: string): boolean {
        const nodeStateCache = new Map<string, 'active' | 'inactive' | 'unresolved' | 'failed'>();

        return session.context.workflow.edges
            .filter((edge) => edge.target === nodeId)
            .every((edge) => this.getParentEdgeState(session, nodeId, edge, nodeStateCache).resolved);
    }

    private getNodeSkipReason(session: DebugSession, node: WorkflowNode): string | undefined {
        const parentEdges = session.context.workflow.edges.filter((edge) => edge.target === node.id);
        if (parentEdges.length === 0) {
            return undefined;
        }

        const nodeStateCache = new Map<string, 'active' | 'inactive' | 'unresolved' | 'failed'>();
        let hasActiveParent = false;
        let inactiveReason: string | undefined;

        for (const parentEdge of parentEdges) {
            const parentState = this.getParentEdgeState(session, node.id, parentEdge, nodeStateCache);
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

    private getParentEdgeState(
        session: DebugSession,
        nodeId: string,
        parentEdge: WorkflowGraph['edges'][number],
        nodeStateCache: Map<string, 'active' | 'inactive' | 'unresolved' | 'failed'>
    ): {
        resolved: boolean;
        active: boolean;
        reason?: string;
    } {
        const parentNode = session.nodeById.get(parentEdge.source);
        if (!parentNode) {
            return {
                resolved: true,
                active: false
            };
        }

        const parentState = this.getRuntimeNodeState(session, parentNode.id, nodeStateCache);
        if (parentState === 'unresolved') {
            return {
                resolved: false,
                active: false,
                reason: `Parent node "${parentNode.id}" has not executed`
            };
        }

        if (parentState === 'inactive') {
            return {
                resolved: true,
                active: false
            };
        }

        if (parentState === 'failed') {
            const parentStatus = session.nodeStatuses.get(parentNode.id);
            return {
                resolved: true,
                active: true,
                reason: parentStatus === 'error'
                    ? `Parent node "${parentNode.id}" failed`
                    : `Parent node "${parentNode.id}" was skipped`
            };
        }

        const parentOutput = session.context.outputs.get(parentNode.id) ?? {};

        if (parentNode.type === WorkflowNodeType.ForEach) {
            const itemCount = typeof parentOutput.count === 'number'
                ? parentOutput.count
                : Array.isArray(parentOutput.items)
                    ? parentOutput.items.length
                    : 0;
            if (itemCount <= 0) {
                return {
                    resolved: true,
                    active: false,
                    reason: `ForEach node "${parentNode.id}" produced no items`
                };
            }

            return {
                resolved: true,
                active: true
            };
        }

        if (parentNode.type === WorkflowNodeType.IfStatement) {
            const branch = readWorkflowIfBranch(parentOutput, parentNode.id);
            if (!matchesIfBranchHandle(parentEdge.sourceHandle, branch)) {
                return {
                    resolved: true,
                    active: false,
                    reason: `Node "${nodeId}" is not on the selected "${branch}" branch`
                };
            }

            return {
                resolved: true,
                active: true
            };
        }

        if (parentNode.type === WorkflowNodeType.SwitchStatement) {
            const matchedCaseId = typeof parentOutput.matchedCaseId === 'string' && parentOutput.matchedCaseId.length > 0
                ? parentOutput.matchedCaseId
                : null;

            if (parentEdge.sourceHandle === 'continue') {
                return {
                    resolved: true,
                    active: true
                };
            }

            if (parentEdge.sourceHandle === 'cases' && matchedCaseId === nodeId) {
                return {
                    resolved: true,
                    active: true
                };
            }

            return {
                resolved: true,
                active: false,
                reason: matchedCaseId
                    ? `Switch statement "${parentNode.id}" selected case "${matchedCaseId}"`
                    : `Switch statement "${parentNode.id}" did not match this case`
            };
        }

        if (parentNode.type === WorkflowNodeType.SwitchCase) {
            const switchEdge = session.context.workflow.edges.find((edge) => edge.target === parentNode.id);
            const switchNode = switchEdge ? session.nodeById.get(switchEdge.source) : undefined;
            const switchStatus = switchNode ? session.nodeStatuses.get(switchNode.id) : undefined;

            if (switchNode && !switchStatus) {
                return {
                    resolved: false,
                    active: false,
                    reason: `Parent node "${switchNode.id}" has not executed`
                };
            }

            if (switchStatus === 'error') {
                return {
                    resolved: true,
                    active: true,
                    reason: `Parent node "${switchNode?.id ?? parentNode.id}" failed`
                };
            }

            if (switchStatus === 'skipped') {
                return {
                    resolved: true,
                    active: true,
                    reason: `Parent node "${switchNode?.id ?? parentNode.id}" was skipped`
                };
            }

            const switchOutput = switchNode ? session.context.outputs.get(switchNode.id) ?? {} : {};
            const matchedCaseId = typeof switchOutput.matchedCaseId === 'string' && switchOutput.matchedCaseId.length > 0
                ? switchOutput.matchedCaseId
                : null;

            if (matchedCaseId !== parentNode.id) {
                return {
                    resolved: true,
                    active: false,
                    reason: `Switch case "${parentNode.id}" is not active`
                };
            }

            return {
                resolved: true,
                active: true
            };
        }

        return {
            resolved: true,
            active: true
        };
    }

    private getRuntimeNodeState(
        session: DebugSession,
        nodeId: string,
        nodeStateCache: Map<string, 'active' | 'inactive' | 'unresolved' | 'failed'>
    ): 'active' | 'inactive' | 'unresolved' | 'failed' {
        const cachedState = nodeStateCache.get(nodeId);
        if (cachedState) {
            return cachedState;
        }

        const workflow = session.context.workflow;
        const parentEdges = workflow.edges.filter((edge) => edge.target === nodeId);
        const nodeStatus = session.nodeStatuses.get(nodeId);

        if (parentEdges.length === 0) {
            const rootState = nodeStatus === 'executed'
                ? 'active'
                : nodeStatus === 'error' || nodeStatus === 'skipped'
                    ? 'failed'
                    : 'unresolved';
            nodeStateCache.set(nodeId, rootState);
            return rootState;
        }

        let hasActiveParent = false;
        let hasUnresolvedParent = false;
        let hasFailedParent = false;

        for (const parentEdge of parentEdges) {
            const parentState = this.getParentEdgeState(session, nodeId, parentEdge, nodeStateCache);
            if (!parentState.resolved) {
                hasUnresolvedParent = true;
                continue;
            }

            if (parentState.active) {
                if (parentState.reason) {
                    hasFailedParent = true;
                    continue;
                }

                hasActiveParent = true;
            }
        }

        const resolvedState = hasActiveParent
            ? (nodeStatus === 'executed'
                ? 'active'
                : nodeStatus === 'error' || nodeStatus === 'skipped'
                    ? 'failed'
                    : 'unresolved')
            : hasUnresolvedParent
                ? 'unresolved'
                : hasFailedParent
                    ? 'failed'
                    : 'inactive';
        nodeStateCache.set(nodeId, resolvedState);

        return resolvedState;
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

        if (node.type === WorkflowNodeType.IfStatement) {
            const { activeNodeIds, inactiveNodeIds } = resolveWorkflowRuntimeChildNodeIds(
                workflow,
                node,
                result.output ?? {}
            );

            return [...activeNodeIds, ...inactiveNodeIds];
        }

        if (node.type === WorkflowNodeType.SwitchStatement) {
            const { activeNodeIds, inactiveNodeIds } = resolveWorkflowRuntimeChildNodeIds(
                workflow,
                node,
                result.output ?? {}
            );

            return [...activeNodeIds, ...inactiveNodeIds];
        }

        return workflow.getChildren(node.id).map((childNode) => childNode.id);
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

        const output: Record<string, unknown> = {
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

        await this.exportNodeProcessorService.process({
            executionData: {
                analysisId: session.context.analysisId,
                trajectoryId: session.context.trajectoryId,
                pluginId: session.context.pluginId,
                storageClusterId: session.storageClusterId ?? 'debug-storage-cluster'
            },
            exposure,
            decodedPayload: inspection.exportPayload,
            timestep: session.context.selectedTimestep ?? preparedExecution.selectedDump.timestep,
            storageClusterId: session.storageClusterId ?? 'debug-storage-cluster',
            artifactUploadBatch: artifactBatch
        });

        const artifacts = artifactBatch.getArtifacts().map((artifact) => ({
            path: artifact.path,
            objectKey: artifact.objectKey,
            bucket: artifact.bucket,
            contentType: artifact.contentType,
            fileName: artifact.fileName
        }));
        const output: Record<string, unknown> = {
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

    private startIdleSweep(): void {
        this.sweepTimer = setInterval(() => {
            const now = Date.now();
            for (const [sessionId, session] of this.sessions) {
                if (now - session.lastActivity > SESSION_IDLE_TTL_MS) {
                    logger.warn(`@debug-session-manager: session ${sessionId} expired (idle TTL)`);
                    this.destroySession(sessionId);
                }
            }
        }, SESSION_SWEEP_INTERVAL_MS);
        this.sweepTimer.unref();
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
                    const entries = await fs.readdir(parentDir);
                    await Promise.all(entries
                        .filter((entry) => entry.startsWith(`${baseName}_`))
                        .map((entry) => fs.rm(path.join(parentDir, entry), {
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
