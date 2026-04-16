import { logger } from '@/core/logger';
import { createExportNodeProcessorService } from '@/modules/artifacts/services/ExportNodeProcessorService';
import {
    createDebugExecutionLogSink
} from '@/modules/job-runtime/services/ExecutionLogStreaming';
import type {
    BinaryExecutorService,
    ProcessExecutionLogSink
} from '@/modules/job-runtime/services/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/job-runtime/services/PluginBinaryCacheService';
import type { NativeModuleLoader } from '@/modules/trajectory-native/services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import type {
    AnalysisExposureDefinition,
    AnalysisJobExecutionData,
    DaemonAnalysisDocument,
    NestedPluginDefinition,
    TrajectoryFrame,
    WorkflowDefinition
} from '@/shared/contracts';
import { createWorkflowExecutionContext, snapshotWorkflowOutputs } from './WorkflowExecutionContextFactory';
import { DebugEntrypointExecutor } from './DebugEntrypointExecutor';
import { createDebugArtifactBatch } from './DebugArtifactBatch';
import { inspectDebugExposureResult } from './DebugExposureProcessor';
import {
    DebugInlinePluginRuntime,
    type DebugTraceNode
} from './DebugInlinePluginRuntime';
import { InlineWorkflowTraceError } from './InlineWorkflowRuntime';
import { runOrderedWorkflowNodes } from './OrderedNodeRunner';
import { WorkflowGraph, WorkflowNodeType } from '../contracts';
import type { WorkflowNodeRegistry } from './NodeRegistry';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DaemonJobReporterService } from '@/modules/cloud-control/services';
import type { ExportNodeProcessorService } from '@/modules/artifacts/services/ExportNodeProcessorService';
import type { ExecutionLogSegmentMetadata } from '@/modules/job-runtime/services/ExecutionLogStreaming';
import type { PreparedDebugExecutionEnvironment } from './DebugEntrypointExecutor';
import type { DebugExposureInspectionResult } from './DebugExposureProcessor';
import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';

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
    nestedTrace?: DebugTraceNode[];
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
    const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));
    const exposuresByNodeId = new Map<string, AnalysisExposureDefinition>();
    const exportNodeToExposureNodeId = new Map<string, string>();

    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.Exposure) {
            continue;
        }

        const exposureData = node.data.exposure as {
            name?: string;
            results?: string;
            iterable?: string;
        } | undefined;
        const exportEdge = workflow.edges.find((edge) => edge.source === node.id);
        const exportNode = exportEdge
            ? nodeById.get(exportEdge.target)
            : undefined;

        if (exportNode?.type === WorkflowNodeType.Export) {
            exportNodeToExposureNodeId.set(exportNode.id, node.id);
        }

        exposuresByNodeId.set(node.id, {
            nodeId: node.id,
            name: exposureData?.name || node.id,
            results: exposureData?.results || '',
            iterable: exposureData?.iterable,
            export: exportNode?.type === WorkflowNodeType.Export
                ? exportNode.data.export as AnalysisExposureDefinition['export']
                : undefined
        });
    }

    return {
        exposuresByNodeId,
        exportNodeToExposureNodeId
    };
};

interface NodeExecutionOutcome {
    status: 'executed' | 'skipped';
    output?: Record<string, unknown>;
    reason?: string;
    nestedTrace?: DebugTraceNode[];
}

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

const matchesIfBranchHandle = (
    edgeHandle: string | undefined,
    selectedBranch: string
): boolean => {
    if (selectedBranch === 'true') {
        return edgeHandle === 'output-true' || edgeHandle === 'true';
    }

    return edgeHandle === 'output-false' || edgeHandle === 'false';
};

export class DebugSessionManager {
    private readonly sessions = new Map<string, DebugSession>();
    private sweepTimer: ReturnType<typeof setInterval> | null = null;
    private readonly debugEntrypointExecutor: DebugEntrypointExecutor;
    private readonly debugInlinePluginRuntime: DebugInlinePluginRuntime;
    private readonly exportNodeProcessorService: ExportNodeProcessorService;
    private executionLogReporter: Pick<DaemonJobReporterService, 'reportDebugLogChunk'> | null = null;

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
        this.debugInlinePluginRuntime = new DebugInlinePluginRuntime(
            registry,
            deps.pluginBinaryCacheService,
            deps.binaryExecutorService
        );
        this.exportNodeProcessorService = createExportNodeProcessorService(deps.nativeModuleLoader);
        this.startIdleSweep();
    }

    setExecutionLogReporter(
        reporter: Pick<DaemonJobReporterService, 'reportDebugLogChunk'>
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
            this.destroySession(sessionId);
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

            if (!this.getNextPendingNode(session)) {
                this.destroySession(sessionId);
            }

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

            session.pendingNodeIds.push(nodeId);
            session.scheduledNodeIds.add(nodeId);
        }
    }

    private getNodeSkipReason(session: DebugSession, node: WorkflowNode): string | undefined {
        const parentEdges = session.context.workflow.edges.filter((edge) => edge.target === node.id);
        if (parentEdges.length === 0) {
            return undefined;
        }

        const parentEdge = parentEdges[0];
        const parentNode = session.nodeById.get(parentEdge.source);
        if (!parentNode) {
            return undefined;
        }

        const parentStatus = session.nodeStatuses.get(parentNode.id);
        if (!parentStatus) {
            return `Parent node "${parentNode.id}" has not executed`;
        }
        if (parentStatus === 'error') {
            return `Parent node "${parentNode.id}" failed`;
        }
        if (parentStatus === 'skipped') {
            return `Parent node "${parentNode.id}" was skipped`;
        }

        const parentOutput = session.context.outputs.get(parentNode.id) ?? {};

        if (parentNode.type === WorkflowNodeType.ForEach) {
            const itemCount = typeof parentOutput.count === 'number'
                ? parentOutput.count
                : Array.isArray(parentOutput.items)
                    ? parentOutput.items.length
                    : 0;
            if (itemCount <= 0) {
                return `ForEach node "${parentNode.id}" produced no items`;
            }
        }

        if (parentNode.type === WorkflowNodeType.IfStatement) {
            const branch = parentOutput.branch === 'false' ? 'false' : 'true';
            if (!matchesIfBranchHandle(parentEdge.sourceHandle, branch)) {
                return `Node "${node.id}" is not on the selected "${branch}" branch`;
            }
        }

        if (parentNode.type === WorkflowNodeType.SwitchStatement) {
            const matchedCaseId = typeof parentOutput.matchedCaseId === 'string' && parentOutput.matchedCaseId.length > 0
                ? parentOutput.matchedCaseId
                : null;

            if (parentEdge.sourceHandle === 'continue') {
                return undefined;
            }

            if (parentEdge.sourceHandle === 'cases' && matchedCaseId === node.id) {
                return undefined;
            }

            return matchedCaseId
                ? `Switch statement "${parentNode.id}" selected case "${matchedCaseId}"`
                : `Switch statement "${parentNode.id}" did not match this case`;
        }

        if (parentNode.type === WorkflowNodeType.SwitchCase) {
            const switchEdge = session.context.workflow.edges.find((edge) => edge.target === parentNode.id);
            const switchNode = switchEdge ? session.nodeById.get(switchEdge.source) : undefined;
            const switchOutput = switchNode ? session.context.outputs.get(switchNode.id) ?? {} : {};
            const matchedCaseId = typeof switchOutput.matchedCaseId === 'string' && switchOutput.matchedCaseId.length > 0
                ? switchOutput.matchedCaseId
                : null;

            if (matchedCaseId !== parentNode.id) {
                return `Switch case "${parentNode.id}" is not active`;
            }
        }

        return undefined;
    }

    private resolveNextNodeIds(
        session: DebugSession,
        node: WorkflowNode,
        result: NodeExecutionOutcome | null
    ): string[] {
        const workflow = session.context.workflow;

        if (!result || result.status === 'skipped') {
            return getWorkflowChildren(workflow, node.id).map((childNode) => childNode.id);
        }

        if (node.type === WorkflowNodeType.IfStatement) {
            const branch = result.output?.branch === 'false' ? 'false' : 'true';
            const selectedNodeIds = getWorkflowChildren(workflow, node.id)
                .filter((childNode) => {
                    const edge = workflow.edges.find((candidate) => {
                        return candidate.source === node.id && candidate.target === childNode.id;
                    });
                    return matchesIfBranchHandle(edge?.sourceHandle, branch);
                })
                .map((childNode) => childNode.id);
            const skippedNodeIds = getWorkflowChildren(workflow, node.id)
                .map((childNode) => childNode.id)
                .filter((childNodeId) => !selectedNodeIds.includes(childNodeId));

            return [...selectedNodeIds, ...skippedNodeIds];
        }

        if (node.type === WorkflowNodeType.SwitchStatement) {
            const matchedCaseId = typeof result.output?.matchedCaseId === 'string' && result.output.matchedCaseId.length > 0
                ? result.output.matchedCaseId
                : null;
            const continueNodeIds = getWorkflowChildren(workflow, node.id, 'continue').map((childNode) => childNode.id);
            const caseNodeIds = getWorkflowChildren(workflow, node.id, 'cases').map((childNode) => childNode.id);
            const matchedNodeIds = matchedCaseId ? caseNodeIds.filter((childNodeId) => childNodeId === matchedCaseId) : [];
            const unmatchedNodeIds = caseNodeIds.filter((childNodeId) => childNodeId !== matchedCaseId);

            return [...matchedNodeIds, ...continueNodeIds, ...unmatchedNodeIds];
        }

        return getWorkflowChildren(workflow, node.id).map((childNode) => childNode.id);
    }

    private async executePluginNode(
        session: DebugSession,
        node: WorkflowNode
    ): Promise<NodeExecutionOutcome> {
        const preparedExecution = await this.ensurePreparedExecutionEnvironment(session);
        const execution = await this.debugInlinePluginRuntime.executePluginNode({
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

        const exitCode = execution.output.exitCode;
        if (typeof exitCode === 'number' && Number.isFinite(exitCode) && exitCode !== 0) {
            const stderr = typeof execution.output.stderr === 'string'
                ? execution.output.stderr
                : '';
            const stdout = typeof execution.output.stdout === 'string'
                ? execution.output.stdout
                : '';
            throw new Error(
                `Entrypoint exited with code ${exitCode}: ${stderr || stdout || 'Unknown error'}`
            );
        }

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
            } as AnalysisJobExecutionData,
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
