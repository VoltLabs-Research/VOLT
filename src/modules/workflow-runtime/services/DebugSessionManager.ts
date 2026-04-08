import { logger } from '@/core/logger';
import { createWorkflowExecutionContext, snapshotWorkflowOutputs } from './WorkflowExecutionContextFactory';
import { DebugEntrypointExecutor } from './DebugEntrypointExecutor';
import { WorkflowNodeRegistry } from './NodeRegistry';
import { runOrderedWorkflowNodes } from './OrderedNodeRunner';
import { WorkflowGraph, WorkflowNodeType, type WorkflowExecutionContext, type WorkflowNode } from '../contracts';
import type { DaemonAnalysisDocument, WorkflowDefinition } from '@/shared/contracts';
import type { BinaryExecutorService } from '@/modules/job-runtime/services/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/job-runtime/services/PluginBinaryCacheService';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import fs from 'node:fs/promises';

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
 * Node types that participate in the interactive debug flow.
 * Structural nodes that still require the full job-runtime pipeline remain skipped.
 */
const EXECUTABLE_NODE_TYPES = new Set<WorkflowNodeType>([
    WorkflowNodeType.Modifier,
    WorkflowNodeType.Arguments,
    WorkflowNodeType.Context,
    WorkflowNodeType.ForEach,
    WorkflowNodeType.Entrypoint,
    WorkflowNodeType.IfStatement
]);

export interface DebugSessionRequest {
    workflow: WorkflowDefinition;
    trajectoryId: string;
    trajectoryFrames: Array<{ timestep: number; natoms: number; simulationCell: string }>;
    pluginId: string;
    teamId: string;
    userConfig: Record<string, unknown>;
    storageClusterId?: string;
    timestep?: number;
};

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
};

export interface DebugSessionInfo {
    sessionId: string;
    executionOrder: Array<{ nodeId: string; type: string }>;
    forEachNodeId: string | null;
    totalIterations: number;
};

interface DebugSession {
    sessionId: string;
    context: WorkflowExecutionContext;
    /** All nodes in topological order */
    allNodes: WorkflowNode[];
    /** Nodes that the interactive debugger can step through. */
    executableNodes: WorkflowNode[];
    /** Current index into executableNodes */
    currentIndex: number;
    lastActivity: number;
    forEachNodeId: string | null;
    storageClusterId?: string;
    cleanupPaths: string[];
    cleanupDirectories: string[];
};

let sessionCounter = 0;

const generateSessionId = (): string => {
    return `dbg_${Date.now()}_${++sessionCounter}`;
};

export class DebugSessionManager {
    private readonly sessions = new Map<string, DebugSession>();
    private sweepTimer: ReturnType<typeof setInterval> | null = null;
    private readonly debugEntrypointExecutor: DebugEntrypointExecutor;

    constructor(
        private readonly registry: WorkflowNodeRegistry,
        deps: {
            objectStore: ClusterObjectStore;
            pluginBinaryCacheService: PluginBinaryCacheService;
            binaryExecutorService: BinaryExecutorService;
        }
    ) {
        this.debugEntrypointExecutor = new DebugEntrypointExecutor(
            deps.objectStore,
            deps.pluginBinaryCacheService,
            deps.binaryExecutorService
        );
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
            nestedWorkflows: new Map()
        });

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
            forEachNodeId,
            storageClusterId: request.storageClusterId,
            cleanupPaths: [],
            cleanupDirectories: []
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
            let result: { status: 'executed' | 'skipped'; output?: Record<string, unknown>; reason?: string; } | null = null;

            if (node.type === WorkflowNodeType.Entrypoint) {
                const execution = await this.debugEntrypointExecutor.execute(
                    session.sessionId,
                    node,
                    session.context,
                    session.storageClusterId
                );

                session.cleanupPaths.push(execution.dumpPath);
                session.cleanupDirectories.push(execution.outputDir);
                session.context.outputs.set(node.id, execution.output);
                result = {
                    status: 'executed',
                    output: execution.output
                };

                const exitCode = execution.output.exitCode;
                if (typeof exitCode === 'number' && exitCode !== 0) {
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
            } else {
                const [orderedResult] = await runOrderedWorkflowNodes({
                    nodes: [node],
                    context: session.context,
                    registry: this.registry
                });
                result = orderedResult ?? null;
            }
            const durationMs = Date.now() - startTime;

            session.currentIndex++;
            if (session.currentIndex >= session.executableNodes.length) {
                this.destroySession(sessionId);
            }

            if (!result || result.status === 'skipped') {
                return {
                    nodeId: node.id,
                    nodeType: node.type,
                    status: 'skipped',
                    reason: result?.reason ?? `No handler registered for node type "${node.type}"`,
                    durationMs,
                    contextSnapshot: snapshotWorkflowOutputs(session.context.outputs)
                };
            }

            return {
                nodeId: node.id,
                nodeType: node.type,
                status: 'completed',
                output: result.output,
                durationMs,
                contextSnapshot: snapshotWorkflowOutputs(session.context.outputs)
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
                contextSnapshot: snapshotWorkflowOutputs(session.context.outputs)
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
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        this.sessions.delete(sessionId);
        void this.cleanupSessionArtifacts(session).catch((error: unknown) => {
            logger.warn(
                {
                    err: error,
                    sessionId
                },
                '@debug-session-manager: failed to cleanup debug session artifacts'
            );
        });
        logger.info(`@debug-session-manager: destroyed session ${sessionId}`);
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

    private async cleanupSessionArtifacts(session: DebugSession): Promise<void> {
        const cleanupTasks = [
            ...session.cleanupPaths.map((filePath) => fs.rm(filePath, { force: true }).catch(() => {})),
            ...session.cleanupDirectories.map((directoryPath) => fs.rm(directoryPath, { recursive: true, force: true }).catch(() => {}))
        ];

        await Promise.all(cleanupTasks);
    }
};
