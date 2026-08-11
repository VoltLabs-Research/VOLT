import { WorkflowScheduler, type WorkflowExecutionStatus } from '@modules/analysis/services/workflow/WorkflowScheduler';
import type { WorkflowNode } from '@shared/contracts/types/workflow.types';
import type { DebugSession, NodeExecutionOutcome } from '@modules/analysis/services/workflow/debug/debug-session';

const EXECUTION_STATUS_BY_NODE_STATUS = {
    executed: 'executed',
    skipped: 'skipped',
    error: 'failed'
} as const satisfies Record<NonNullable<ReturnType<DebugSession['nodeStatuses']['get']>>, WorkflowExecutionStatus>;

/**
 * A scheduler view over the session's own per-node statuses, so branch resolution
 * behaves the same as it does during a real run.
 */
export const createSessionScheduler = (session: DebugSession): WorkflowScheduler => new WorkflowScheduler({
    workflow: session.context.workflow,
    outputs: session.context.outputs,
    getNodeExecutionStatus: (nodeId) => {
        const status = session.nodeStatuses.get(nodeId);
        return status ? EXECUTION_STATUS_BY_NODE_STATUS[status] : 'pending';
    }
});

/** Peeks the node the next `step` will run, dropping already-completed entries. */
export const getNextPendingNode = (session: DebugSession): WorkflowNode | null => {
    while (session.pendingNodeIds.length > 0) {
        const nodeId = session.pendingNodeIds[session.pendingNodeIds.length - 1];
        if (session.completedNodeIds.has(nodeId)) {
            session.pendingNodeIds.pop();
            continue;
        }

        const node = session.nodeById.get(nodeId);
        if (!node) {
            throw new Error(`Pending workflow node ${nodeId} not found in debug session`);
        }

        return node;
    }

    return null;
};

/** Queues the children a finished node unblocked, skipping those still waiting on a parent. */
export const enqueueReadyNodeIds = (session: DebugSession, nodeIds: string[]): void => {
    const scheduler = createSessionScheduler(session);

    for (let index = nodeIds.length - 1; index >= 0; index -= 1) {
        const nodeId = nodeIds[index];
        if (!nodeId
            || session.completedNodeIds.has(nodeId)
            || session.scheduledNodeIds.has(nodeId)
            || !scheduler.areParentEdgesResolved(nodeId)) {
            continue;
        }

        session.pendingNodeIds.push(nodeId);
        session.scheduledNodeIds.add(nodeId);
    }
};

export const resolveNextNodeIds = (
    session: DebugSession,
    node: WorkflowNode,
    result: NodeExecutionOutcome
): string[] => {
    if (result.status === 'skipped') {
        return session.context.workflow.getChildNodeIds(node.id);
    }

    const { activeNodeIds, inactiveNodeIds } = createSessionScheduler(session)
        .resolveChildNodeIds(node, result.output);

    return [...activeNodeIds, ...inactiveNodeIds];
};
