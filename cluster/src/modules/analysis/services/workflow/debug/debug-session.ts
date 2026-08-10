import { WorkflowSession, type WorkflowOutputsSnapshot } from '@modules/analysis/services/workflow/WorkflowSession';
import { WorkflowGraph, WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import { safeRemovePath } from '@shared/infrastructure/utilities/safe-remove-path';
import fg from 'fast-glob';
import path from 'node:path';
import type { ReverseChannelCommandPayloadView } from '@shared/contracts/channel/reverse-channel-messaging';
import type { WorkflowExposureInspectionResult } from '@shared/contracts/types/workflow-exposure';
import type { DebugEnvironmentState } from '@modules/analysis/services/workflow/debug/DebugEnvironment';
import type { InlineWorkflowTraceNode } from '@modules/analysis/services/workflow/WorkflowWalker';
import type {
    AnalysisExposureDefinition,
    NestedPluginDefinition,
    TrajectoryFrame,
    WorkflowDefinition
} from '@shared/contracts';
import type {
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput
} from '@shared/contracts/types/workflow.types';

export interface DebugSessionRequest {
    workflow: WorkflowDefinition;
    nestedPlugins: NestedPluginDefinition[];
    trajectoryId: string;
    trajectoryFrames: TrajectoryFrame[];
    pluginId: string;
    teamId: string;
    userConfig: ReverseChannelCommandPayloadView;
    storageClusterId: string;
    timestep?: number;
}

export interface DebugSessionInfo {
    sessionId: string;
    executionOrder: Array<{ nodeId: string; type: string }>;
    forEachNodeId: string | null;
    totalIterations: number;
}

export interface DebugNodeResult {
    nodeId: string;
    nodeType: string;
    status: 'completed' | 'skipped' | 'error';
    output?: WorkflowNodeOutput;
    error?: string;
    stack?: string;
    reason?: string;
    nestedTrace?: InlineWorkflowTraceNode[];
    durationMs: number;
    contextSnapshot: WorkflowOutputsSnapshot;
}

export interface CurrentDebugNodeInfo {
    nodeId: string;
    nodeType: string;
    index: number;
    total: number;
}

export type NodeExecutionOutcome =
    | { status: 'executed'; output: WorkflowNodeOutput; nestedTrace?: InlineWorkflowTraceNode[] }
    | { status: 'skipped'; reason: string };

/** A workflow paused mid-graph, advanced one node at a time by the debug commands. */
export interface DebugSession {
    sessionId: string;
    context: WorkflowExecutionContext;
    executableNodes: WorkflowNode[];
    nodeById: Map<string, WorkflowNode>;
    pendingNodeIds: string[];
    scheduledNodeIds: Set<string>;
    completedNodeIds: Set<string>;
    nodeStatuses: Map<string, 'executed' | 'skipped' | 'error'>;
    forEachNodeId: string | null;
    storageClusterId: string;
    nestedPlugins: NestedPluginDefinition[];
    preparedExecution: DebugEnvironmentState | null;
    exposureCache: Map<string, WorkflowExposureInspectionResult>;
    exposuresByNodeId: Map<string, AnalysisExposureDefinition>;
    exportNodeToExposureNodeId: Map<string, string>;
    cleanupPaths: string[];
    cleanupDirectories: string[];
}

let sessionCounter = 0;

export const createDebugSession = (request: DebugSessionRequest): DebugSession => {
    const {
        workflow: workflowDefinition,
        storageClusterId,
        timestep: selectedTimestep,
        ...sessionParams
    } = request;
    const sessionId = `dbg_${Date.now()}_${++sessionCounter}`;
    const workflow = new WorkflowGraph(workflowDefinition);
    const executableNodes = workflow.topologicalSort();
    const rootNodeIds = workflow.getRootNodeIds();
    const hasSelectedTimestep = selectedTimestep !== undefined;
    const { exposuresByNodeId, exportNodeToExposureNodeId } = WorkflowSession.buildExposureMaps(workflowDefinition);

    const context = WorkflowSession.create({
        ...sessionParams,
        runtimeArguments: {},
        analysis: {
            _id: `debug_${sessionId}`,
            pluginDisplayName: 'Debug Session'
        },
        analysisId: `debug_${sessionId}`,
        selectedFrameOnly: hasSelectedTimestep,
        selectedTimesteps: hasSelectedTimestep ? [selectedTimestep] : undefined,
        selectedTimestep,
        workflow
    }).context;

    return {
        sessionId,
        context,
        executableNodes,
        nodeById: new Map(executableNodes.map((node) => [node.id, node])),
        pendingNodeIds: [...rootNodeIds].reverse(),
        scheduledNodeIds: new Set(rootNodeIds),
        completedNodeIds: new Set(),
        nodeStatuses: new Map(),
        forEachNodeId: executableNodes.find((node) => node.type === WorkflowNodeType.ForEach)?.id ?? null,
        storageClusterId,
        nestedPlugins: sessionParams.nestedPlugins,
        preparedExecution: null,
        exposureCache: new Map(),
        exposuresByNodeId,
        exportNodeToExposureNodeId,
        cleanupPaths: [],
        cleanupDirectories: []
    };
};

export const describeDebugSession = (session: DebugSession, request: DebugSessionRequest): DebugSessionInfo => ({
    sessionId: session.sessionId,
    executionOrder: session.executableNodes.map((node) => ({
        nodeId: node.id,
        type: node.type
    })),
    forEachNodeId: session.forEachNodeId,
    totalIterations: session.forEachNodeId === null
        ? 0
        : (request.timestep !== undefined ? 1 : request.trajectoryFrames.length)
});

/**
 * Removes the dump and output directory the session materialised, plus the
 * `<outputDir>_*` siblings the export nodes wrote next to it.
 */
export const cleanupDebugSessionArtifacts = async (session: DebugSession): Promise<void> => {
    await Promise.all([
        ...session.cleanupPaths.map((filePath) => safeRemovePath(filePath)),
        ...Array.from(new Set(session.cleanupDirectories)).map(async (directoryPath) => {
            await safeRemovePath(directoryPath, { recursive: true });

            try {
                const siblingPaths = await fg(`${fg.escapePath(path.basename(directoryPath))}_*`, {
                    cwd: path.dirname(directoryPath),
                    absolute: true,
                    onlyFiles: false,
                    dot: true,
                    unique: true
                });
                await Promise.all(siblingPaths.map((siblingPath) => safeRemovePath(siblingPath, { recursive: true })));
            } catch {
            }
        })
    ]);
};
