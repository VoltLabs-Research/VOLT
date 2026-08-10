import { singleton } from '@shared/application/utilities/singleton';
import { getWorkflowNodeRegistry, type WorkflowNodeRegistry } from '@modules/analysis/services/workflow/NodeRegistry';
import { DebugEnvironment, getDebugEnvironment } from '@modules/analysis/services/workflow/debug/DebugEnvironment';
import { getPluginBinaryCache } from '@modules/plugin/services/binaries/PluginBinaryCache';
import { getBinaryExecutorService } from '@modules/plugin/services/runtime/BinaryExecutorService';
import { TTLCache } from '@isaacs/ttlcache';
import { logger } from '@shared/infrastructure/logger';
import { WorkflowNodeExecutor } from '@modules/analysis/services/workflow/WorkflowNodeExecutor';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import { WorkflowRuntime, getWorkflowRuntime } from '@modules/analysis/services/workflow/WorkflowRuntime';
import { readWorkflowTrace } from '@modules/analysis/services/workflow/WorkflowWalker';
import {
    cleanupDebugSessionArtifacts,
    createDebugSession,
    describeDebugSession,
    type CurrentDebugNodeInfo,
    type DebugNodeResult,
    type DebugSession,
    type DebugSessionInfo,
    type DebugSessionRequest,
    type NodeExecutionOutcome
} from '@modules/analysis/services/workflow/debug/debug-session';
import {
    createSessionScheduler,
    enqueueReadyNodeIds,
    getNextPendingNode,
    resolveNextNodeIds
} from '@modules/analysis/services/workflow/debug/debug-session-scheduling';
import {
    createDebugNodeRunner,
    type DebugNodeRunner
} from '@modules/analysis/services/workflow/debug/debug-node-execution';
import type { BinaryExecutorService } from '@modules/plugin/services/runtime/BinaryExecutorService';
import type { PluginBinaryCache } from '@modules/plugin/services/binaries/PluginBinaryCache';

const SESSION_IDLE_TTL_MS = 5 * 60 * 1000;

/**
 * Steps a workflow one node at a time for the plugin debugger, keeping each session's
 * outputs and materialised dump alive between commands until it goes idle.
 */
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

            void cleanupDebugSessionArtifacts(session).catch((error: unknown) => {
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
    private readonly runNode: DebugNodeRunner;

    constructor(
        workflowNodeRegistry: WorkflowNodeRegistry,
        debugEnvironment: DebugEnvironment,
        workflowRuntime: WorkflowRuntime,
        pluginBinaryCache: PluginBinaryCache,
        binaryExecutorService: BinaryExecutorService
    ) {
        this.runNode = createDebugNodeRunner({
            nodeExecutor: new WorkflowNodeExecutor(workflowNodeRegistry),
            debugEnvironment,
            workflowRuntime,
            pluginBinaryCache,
            binaryExecutorService
        });
    }

    createSession(request: DebugSessionRequest): DebugSessionInfo {
        const session = createDebugSession(request);
        this.sessions.set(session.sessionId, session);
        return describeDebugSession(session, request);
    }

    async executeCurrentNode(sessionId: string): Promise<DebugNodeResult | null> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        const node = getNextPendingNode(session);
        if (!node) {
            return null;
        }
        const startTime = Date.now();
        const describeStep = () => ({
            nodeId: node.id,
            nodeType: node.type,
            durationMs: Date.now() - startTime,
            contextSnapshot: WorkflowSession.snapshotOutputs(session.context.outputs)
        });

        try {
            const skipReason = createSessionScheduler(session).getSkipReason(node);
            const result: NodeExecutionOutcome = skipReason
                ? {
                    status: 'skipped',
                    reason: skipReason
                }
                : await this.runNode(session, node);

            session.completedNodeIds.add(node.id);
            session.nodeStatuses.set(node.id, result.status);
            enqueueReadyNodeIds(session, resolveNextNodeIds(session, node, result));

            return {
                ...describeStep(),
                ...(result.status === 'skipped'
                    ? {
                        status: 'skipped',
                        reason: result.reason
                    }
                    : {
                        status: 'completed',
                        output: result.output,
                        nestedTrace: result.nestedTrace
                    })
            };
        } catch (error) {
            session.completedNodeIds.add(node.id);
            session.nodeStatuses.set(node.id, 'error');
            this.destroySession(sessionId);

            return {
                ...describeStep(),
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                nestedTrace: readWorkflowTrace(error)
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

    getCurrentNodeInfo(sessionId: string): CurrentDebugNodeInfo | null {
        const session = this.sessions.get(sessionId);
        const node = session && getNextPendingNode(session);
        if (!session || !node) {
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
}

export const getDebugSessionManager = singleton((): DebugSessionManager => new DebugSessionManager(getWorkflowNodeRegistry(), getDebugEnvironment(), getWorkflowRuntime(), getPluginBinaryCache(), getBinaryExecutorService()));
