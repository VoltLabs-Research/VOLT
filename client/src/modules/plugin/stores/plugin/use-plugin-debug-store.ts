import { create } from 'zustand';

export enum DebugNodeStatus {
    Pending = 'pending',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed',
    Skipped = 'skipped'
};

type DebugContextSnapshot = Record<string, Record<string, unknown>>;

export interface DebugExecutionLogSegment {
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
    occurredAt: string;
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    pluginId?: string;
    executionPath?: string[];
}

export interface DebugNodeState {
    status: DebugNodeStatus;
    output?: Record<string, unknown>;
    error?: string;
    stack?: string;
    durationMs?: number;
    reason?: string;
    nestedTrace?: DebugTraceNode[];
    logSegments?: DebugExecutionLogSegment[];
};

export interface DebugTraceNode {
    traceId: string;
    nodeId: string;
    nodeType: string;
    status: 'completed' | 'skipped' | 'error';
    durationMs: number;
    output?: Record<string, unknown>;
    reason?: string;
    error?: string;
    stack?: string;
    pluginId?: string;
    label?: string;
    children?: DebugTraceNode[];
}

interface ExecutionOrderItem {
    nodeId: string;
    type: string;
};

interface PluginDebugState {
    // Session state
    sessionId: string | null;
    isDebugging: boolean;
    isPaused: boolean;
    isStarting: boolean;

    // Execution
    executionOrder: ExecutionOrderItem[];
    nodeStates: Record<string, DebugNodeState>;
    currentNodeId: string | null;
    currentNodeIndex: number;
    totalNodes: number;

    // Inspector
    inspectedNodeId: string | null;

    // Context snapshot (accumulated outputs from all nodes)
    contextSnapshot: DebugContextSnapshot;

    // ForEach iteration info
    forEachNodeId: string | null;
    totalIterations: number;

    // Arguments config
    debugConfig: Record<string, unknown>;
    showArgumentsPanel: boolean;

    // Results
    totalDuration: number | null;
    sessionError: string | null;
};

interface PluginDebugActions {
    // Session lifecycle
    setStarting: () => void;
    onSessionCreated: (sessionId: string, executionOrder: ExecutionOrderItem[], forEachNodeId: string | null, totalIterations: number) => void;
    onNodeStarted: (nodeId: string, index: number, total: number) => void;
    onNodeLogChunk: (nodeId: string, segments: DebugExecutionLogSegment[]) => void;
    onNodeCompleted: (nodeId: string, output: Record<string, unknown>, durationMs: number, contextSnapshot: DebugContextSnapshot, nestedTrace?: DebugTraceNode[]) => void;
    onNodeSkipped: (nodeId: string, reason: string, nestedTrace?: DebugTraceNode[]) => void;
    onNodeError: (nodeId: string, error: string, stack?: string, nestedTrace?: DebugTraceNode[]) => void;
    onSessionCompleted: (totalDuration: number) => void;
    onSessionError: (error: string) => void;

    // User actions
    setInspectedNode: (nodeId: string | null) => void;
    setDebugConfigField: (key: string, value: unknown) => void;
    setDebugConfig: (config: Record<string, unknown>) => void;
    setShowArgumentsPanel: (show: boolean) => void;
    reset: () => void;
};

type PluginDebugStore = PluginDebugState & PluginDebugActions;

const initialState: PluginDebugState = {
    sessionId: null,
    isDebugging: false,
    isPaused: false,
    isStarting: false,
    executionOrder: [],
    nodeStates: {},
    currentNodeId: null,
    currentNodeIndex: -1,
    totalNodes: 0,
    inspectedNodeId: null,
    contextSnapshot: {},
    forEachNodeId: null,
    totalIterations: 0,
    debugConfig: {},
    showArgumentsPanel: false,
    totalDuration: null,
    sessionError: null
};

export const usePluginDebugStore = create<PluginDebugStore>((set) => ({
    ...initialState,

    setStarting: () => set({
        isStarting: true,
        sessionError: null,
        nodeStates: {},
        executionOrder: [],
        currentNodeId: null,
        currentNodeIndex: -1,
        totalNodes: 0,
        inspectedNodeId: null,
        totalDuration: null
    }),

    onSessionCreated: (sessionId, executionOrder, forEachNodeId, totalIterations) => {
        const nodeStates: Record<string, DebugNodeState> = {};
        for (const item of executionOrder) {
            nodeStates[item.nodeId] = { status: DebugNodeStatus.Pending };
        }
        set({
            sessionId,
            executionOrder,
            nodeStates,
            isDebugging: true,
            isStarting: false,
            isPaused: false,
            totalNodes: executionOrder.length,
            sessionError: null,
            forEachNodeId,
            totalIterations
        });
    },

    onNodeStarted: (nodeId, index, total) => set((state) => {
        return {
            currentNodeId: nodeId,
            currentNodeIndex: index,
            totalNodes: total,
            isPaused: true,
            inspectedNodeId: nodeId,
            nodeStates: {
                ...state.nodeStates,
                [nodeId]: { ...state.nodeStates[nodeId], status: DebugNodeStatus.Running }
            }
        };
    }),

    onNodeLogChunk: (nodeId, segments) => set((state) => ({
        nodeStates: {
            ...state.nodeStates,
            [nodeId]: {
                ...state.nodeStates[nodeId],
                logSegments: (state.nodeStates[nodeId]?.logSegments ?? []).concat(segments)
            }
        }
    })),

    onNodeCompleted: (nodeId, output, durationMs, contextSnapshot, nestedTrace) => set((state) => {
        return {
            isPaused: false,
            contextSnapshot: contextSnapshot ?? state.contextSnapshot,
            nodeStates: {
                ...state.nodeStates,
                [nodeId]: {
                    ...state.nodeStates[nodeId],
                    status: DebugNodeStatus.Completed,
                    output,
                    durationMs,
                    nestedTrace
                }
            }
        };
    }),

    onNodeSkipped: (nodeId, reason, nestedTrace) => set((state) => ({
        nodeStates: {
            ...state.nodeStates,
            [nodeId]: {
                ...state.nodeStates[nodeId],
                status: DebugNodeStatus.Skipped,
                reason,
                nestedTrace
            }
        }
    })),

    onNodeError: (nodeId, error, stack, nestedTrace) => set((state) => {
        return {
            isPaused: false,
            isDebugging: false,
            // Use -1 as sentinel so the context panel stays visible (totalDuration !== null check)
            totalDuration: state.totalDuration ?? -1,
            nodeStates: {
                ...state.nodeStates,
                [nodeId]: {
                    ...state.nodeStates[nodeId],
                    status: DebugNodeStatus.Failed,
                    error,
                    stack,
                    nestedTrace
                }
            }
        };
    }),

    onSessionCompleted: (totalDuration) => {
        set({
            isDebugging: false,
            isPaused: false,
            currentNodeId: null,
            totalDuration
        });
    },

    onSessionError: (error) => set((state) => {
        return {
            isDebugging: false,
            isPaused: false,
            isStarting: false,
            sessionError: error,
            // Preserve panel visibility if we accumulated any context before the error
            totalDuration: state.totalDuration ?? (Object.keys(state.contextSnapshot).length > 0 ? -1 : null)
        };
    }),

    setInspectedNode: (nodeId) => set({ inspectedNodeId: nodeId }),

    setDebugConfigField: (key, value) => set((state) => ({
        debugConfig: { ...state.debugConfig, [key]: value }
    })),

    setDebugConfig: (config) => set({ debugConfig: config }),

    setShowArgumentsPanel: (show) => set({ showArgumentsPanel: show }),

    reset: () => set(initialState)
}));
