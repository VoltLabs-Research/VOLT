import type { IWorkflow } from './workflow';
import type { NestedPluginDefinition, TrajectoryFrame } from '../analysis/daemon';

// Payloads and results of the debug commands in DaemonCommand.

export type DebugNodeStatus = 'completed' | 'skipped' | 'error';

export interface DebugTraceNode{
    traceId: string;
    nodeId: string;
    nodeType: string;
    status: DebugNodeStatus;
    durationMs: number;
    output?: Record<string, unknown>;
    reason?: string;
    error?: string;
    stack?: string;
    pluginId?: string;
    label?: string;
    children?: DebugTraceNode[];
}

export interface DebugNodeResult{
    nodeId: string;
    nodeType: string;
    status: DebugNodeStatus;
    output?: Record<string, unknown>;
    error?: string;
    stack?: string;
    reason?: string;
    nestedTrace?: DebugTraceNode[];
    durationMs: number;
    contextSnapshot: Record<string, Record<string, unknown>>;
}

export interface DebugNodePosition{
    nodeId: string;
    nodeType: string;
    index: number;
    total: number;
}

export interface DebugStartRequest{
    workflow: IWorkflow;
    trajectoryFrames: TrajectoryFrame[];
    pluginId: string;
    teamId: string;
    trajectoryId: string;
    config?: Record<string, unknown>;
    timestep?: number;
    storageClusterId: string;
    nestedPlugins?: NestedPluginDefinition[];
}

export interface DebugSessionInfo{
    sessionId: string;
    executionOrder: Array<{ nodeId: string; type: string }>;
    forEachNodeId: string | null;
    totalIterations: number;
}

export interface DebugStartResult extends DebugSessionInfo{
    firstNode: DebugNodePosition | null;
}

export interface DebugSessionRequest{
    sessionId: string;
}

export interface DebugStepResult{
    result: DebugNodeResult | null;
    nextNode: DebugNodePosition | null;
    hasMore: boolean;
}

export interface DebugContinueResult{
    results: DebugNodeResult[];
}

export interface DebugStopResult{
    stopped: boolean;
}
