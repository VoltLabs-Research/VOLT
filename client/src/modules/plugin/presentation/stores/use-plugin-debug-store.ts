import { create } from 'zustand';

export type DebugNodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface DebugNodeState {
    status: DebugNodeStatus;
    output?: Record<string, unknown>;
    error?: string;
    stack?: string;
    durationMs?: number;
    reason?: string;
};

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

    // Selection
    selectedTrajectoryId: string | null;
    selectedTimestep: number | null;

    // Execution
    executionOrder: ExecutionOrderItem[];
    nodeStates: Record<string, DebugNodeState>;
    currentNodeId: string | null;
    currentNodeIndex: number;
    totalNodes: number;

    // Inspector
    inspectedNodeId: string | null;

    // Context snapshot (accumulated outputs from all nodes)
    contextSnapshot: Record<string, Record<string, unknown>>;

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
    onNodeCompleted: (nodeId: string, output: Record<string, any>, durationMs: number, contextSnapshot: Record<string, Record<string, any>>) => void;
    onNodeSkipped: (nodeId: string, reason: string) => void;
    onNodeError: (nodeId: string, error: string, stack?: string) => void;
    onSessionCompleted: (totalDuration: number) => void;
    onSessionError: (error: string) => void;

    // User actions
    setSelectedTrajectory: (trajectoryId: string | null) => void;
    setSelectedTimestep: (timestep: number | null) => void;
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
    selectedTrajectoryId: null,
    selectedTimestep: null,
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
            nodeStates[item.nodeId] = { status: 'pending' };
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

    onNodeStarted: (nodeId, index, total) => set((state) => ({
        currentNodeId: nodeId,
        currentNodeIndex: index,
        totalNodes: total,
        isPaused: true,
        inspectedNodeId: nodeId,
        nodeStates: {
            ...state.nodeStates,
            [nodeId]: { ...state.nodeStates[nodeId], status: 'running' }
        }
    })),

    onNodeCompleted: (nodeId, output, durationMs, contextSnapshot) => set((state) => ({
        isPaused: false,
        contextSnapshot: contextSnapshot ?? state.contextSnapshot,
        nodeStates: {
            ...state.nodeStates,
            [nodeId]: { status: 'completed', output, durationMs }
        }
    })),

    onNodeSkipped: (nodeId, reason) => set((state) => ({
        nodeStates: {
            ...state.nodeStates,
            [nodeId]: { status: 'skipped', reason }
        }
    })),

    onNodeError: (nodeId, error, stack) => set((state) => ({
        isPaused: false,
        isDebugging: false,
        // Use -1 as sentinel so the context panel stays visible (totalDuration !== null check)
        totalDuration: state.totalDuration ?? -1,
        nodeStates: {
            ...state.nodeStates,
            [nodeId]: { status: 'failed', error, stack }
        }
    })),

    onSessionCompleted: (totalDuration) => set({
        isDebugging: false,
        isPaused: false,
        currentNodeId: null,
        totalDuration
    }),

    onSessionError: (error) => set((state) => ({
        isDebugging: false,
        isPaused: false,
        isStarting: false,
        sessionError: error,
        // Preserve panel visibility if we accumulated any context before the error
        totalDuration: state.totalDuration ?? (Object.keys(state.contextSnapshot).length > 0 ? -1 : null)
    })),

    setSelectedTrajectory: (trajectoryId) => set({
        selectedTrajectoryId: trajectoryId,
        selectedTimestep: null
    }),

    setSelectedTimestep: (timestep) => set({ selectedTimestep: timestep }),

    setInspectedNode: (nodeId) => set({ inspectedNodeId: nodeId }),

    setDebugConfigField: (key, value) => set((state) => ({
        debugConfig: { ...state.debugConfig, [key]: value }
    })),

    setDebugConfig: (config) => set({ debugConfig: config }),

    setShowArgumentsPanel: (show) => set({ showArgumentsPanel: show }),

    reset: () => set(initialState)
}));
