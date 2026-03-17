import { logger } from '@/core/logger';
import { WorkflowNodeRegistry } from './NodeRegistry';
import { WorkflowGraph, WorkflowNodeType, type WorkflowExecutionContext, type WorkflowNode } from '../contracts';
import type { DaemonAnalysisDocument, WorkflowDefinition } from '@/shared/contracts';

/**
 * Idle TTL for debug sessions (5 minutes).
 * Sessions not stepped/continued within this window are automatically destroyed.
 */
const SESSION_IDLE_TTL_MS = 5 * 60 * 1000;

/**
 * How often to sweep for idle sessions.
 */
const SESSION_SWEEP_INTERVAL_MS = 30 * 1000;

/**
 * Node types that have registered handlers and can be executed.
 * Structural nodes (entrypoint, plugin-node, exposure, export) are skipped.
 */
const EXECUTABLE_NODE_TYPES = new Set<WorkflowNodeType>([
    WorkflowNodeType.Modifier,
    WorkflowNodeType.Arguments,
    WorkflowNodeType.Context,
    WorkflowNodeType.ForEach,
    WorkflowNodeType.IfStatement
]);

export interface DebugSessionRequest {
    workflow: WorkflowDefinition;
    trajectoryId: string;
    trajectoryFrames: Array<{ timestep: number; natoms: number; simulationCell: string }>;
    pluginId: string;
    teamId: string;
    userConfig: Record<string, unknown>;
    timestep?: number;
}

export interface DebugNodeResult {
    nodeId: string;
    nodeType: string;
    status: 'completed' | 'skipped' | 'error';
    output?: Record<string, unknown>;
    error?: string;
    stack?: string;
    reason?: string;
    durationMs: number;
    contextSnapshot: Record<string, Record<string, unknown>>;
}

export interface DebugSessionInfo {
    sessionId: string;
    executionOrder: Array<{ nodeId: string; type: string }>;
    forEachNodeId: string | null;
    totalIterations: number;
}

interface DebugSession {
    sessionId: string;
    context: WorkflowExecutionContext;
    /** All nodes in topological order */
    allNodes: WorkflowNode[];
    /** Only executable nodes (those with handlers) */
    executableNodes: WorkflowNode[];
    /** Current index into executableNodes */
    currentIndex: number;
    lastActivity: number;
    forEachNodeId: string | null;
}

let sessionCounter = 0;

const generateSessionId = (): string => {
    return `dbg_${Date.now()}_${++sessionCounter}`;
};

const buildContextSnapshot = (context: WorkflowExecutionContext): Record<string, Record<string, unknown>> => {
    const snapshot: Record<string, Record<string, unknown>> = {};
    context.outputs.forEach((value, key) => {
        snapshot[key] = value;
    });
    return snapshot;
};

export class DebugSessionManager {
    private readonly sessions = new Map<string, DebugSession>();
    private sweepTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {
        this.startIdleSweep();
    }

    createSession(request: DebugSessionRequest): DebugSessionInfo {
        const sessionId = generateSessionId();
        const workflow = new WorkflowGraph(request.workflow);
        const allNodes = workflow.topologicalSort();
        const executableNodes = allNodes.filter((node) => EXECUTABLE_NODE_TYPES.has(node.type));

        // Create a stub analysis for the execution context.
        // Debug sessions don't have a real analysis — we create a minimal one.
        const stubAnalysis: DaemonAnalysisDocument = {
            _id: `debug_${sessionId}`,
            pluginDisplayName: 'Debug Session'
        };

        const context: WorkflowExecutionContext = {
            outputs: new Map(),
            userConfig: request.userConfig,
            runtimeArguments: {},
            trajectoryId: request.trajectoryId,
            trajectoryFrames: request.trajectoryFrames,
            analysis: stubAnalysis,
            analysisId: `debug_${sessionId}`,
            generatedFiles: [],
            pluginId: request.pluginId,
            teamId: request.teamId,
            selectedTimestep: request.timestep,
            workflow,
            nestedWorkflows: new Map()
        };

        // Detect forEach node
        let forEachNodeId: string | null = null;
        for (const node of executableNodes) {
            if (node.type === WorkflowNodeType.ForEach) {
                forEachNodeId = node.id;
                break;
            }
        }

        const session: DebugSession = {
            sessionId,
            context,
            allNodes,
            executableNodes,
            currentIndex: 0,
            lastActivity: Date.now(),
            forEachNodeId
        };

        this.sessions.set(sessionId, session);
        logger.info(`@debug-session-manager: created session ${sessionId} with ${executableNodes.length} executable nodes (${allNodes.length} total)`);

        return {
            sessionId,
            executionOrder: executableNodes.map((node) => ({ nodeId: node.id, type: node.type })),
            forEachNodeId,
            totalIterations: 0
        };
    }

    async executeCurrentNode(sessionId: string): Promise<DebugNodeResult | null> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        session.lastActivity = Date.now();

        if (session.currentIndex >= session.executableNodes.length) {
            return null;
        }

        const node = session.executableNodes[session.currentIndex];
        const startTime = Date.now();

        try {
            // Skip if the registry doesn't have a handler for this node type
            if (!this.registry.has(node.type)) {
                session.currentIndex++;
                return {
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'skipped',
                    reason: `No handler registered for node type "${node.type}"`,
                    durationMs: Date.now() - startTime,
                    contextSnapshot: buildContextSnapshot(session.context)
                };
            }

            const output = await this.registry.execute(node, session.context);
            const durationMs = Date.now() - startTime;

            session.currentIndex++;

            return {
                nodeId: node.id,
                nodeType: node.type,
                status: 'completed',
                output,
                durationMs,
                contextSnapshot: buildContextSnapshot(session.context)
            };
        } catch (error: unknown) {
            const durationMs = Date.now() - startTime;
            const message = error instanceof Error ? error.message : 'Unknown error';
            const stack = error instanceof Error ? error.stack : undefined;

            // Don't advance index on error — session is effectively dead
            return {
                nodeId: node.id,
                nodeType: node.type,
                status: 'error',
                error: message,
                stack,
                durationMs,
                contextSnapshot: buildContextSnapshot(session.context)
            };
        }
    }

    async executeAllRemaining(sessionId: string): Promise<DebugNodeResult[]> {
        const results: DebugNodeResult[] = [];

        while (true) {
            const session = this.sessions.get(sessionId);
            if (!session || session.currentIndex >= session.executableNodes.length) {
                break;
            }

            const result = await this.executeCurrentNode(sessionId);
            if (!result) {
                break;
            }

            results.push(result);

            // Stop on error — don't continue past a failed node
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

        return session.currentIndex < session.executableNodes.length;
    }

    getCurrentNodeInfo(sessionId: string): { nodeId: string; nodeType: string; index: number; total: number } | null {
        const session = this.sessions.get(sessionId);
        if (!session || session.currentIndex >= session.executableNodes.length) {
            return null;
        }

        const node = session.executableNodes[session.currentIndex];
        return {
            nodeId: node.id,
            nodeType: node.type,
            index: session.currentIndex,
            total: session.executableNodes.length
        };
    }

    destroySession(sessionId: string): void {
        if (this.sessions.delete(sessionId)) {
            logger.info(`@debug-session-manager: destroyed session ${sessionId}`);
        }
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
}
