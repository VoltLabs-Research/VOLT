import { matchesIfBranchHandle, WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowEdge, WorkflowNode, WorkflowOutputs } from '@/modules/analysis/contracts/workflow.types';

export const readWorkflowIfBranch = (
    output: Record<string, unknown>,
    nodeId: string
): 'true' | 'false' => {
    if (output.branch === 'true' || output.branch === 'false') {
        return output.branch;
    }

    throw new Error(`IfStatement node "${nodeId}" produced an invalid branch result`);
};

export type WorkflowExecutionStatus = 'executed' | 'pending' | 'failed' | 'skipped';

export type WorkflowRuntimeNodeState = 'active' | 'inactive' | 'unresolved' | 'failed';

export interface WorkflowParentEdgeResolution {
    resolved: boolean;
    active: boolean;
    reason?: string;
}

interface WorkflowRuntimeSchedulingInput {
    workflow: WorkflowGraph;
    outputs: WorkflowOutputs;
    getNodeExecutionStatus: (nodeId: string) => WorkflowExecutionStatus;
}

interface ResolveWorkflowParentEdgeStateInput extends WorkflowRuntimeSchedulingInput {
    edge: WorkflowEdge;
    targetNodeId: string;
    nodeStateCache: Map<string, WorkflowRuntimeNodeState>;
    resolvingNodeIds: Set<string>;
}

interface ResolveWorkflowRuntimeNodeStateInput extends WorkflowRuntimeSchedulingInput {
    nodeId: string;
    nodeStateCache: Map<string, WorkflowRuntimeNodeState>;
    resolvingNodeIds: Set<string>;
}

const resolveActiveParentEdgeState = (
    workflow: WorkflowGraph,
    edge: WorkflowEdge,
    targetNodeId: string,
    outputs: WorkflowOutputs
): WorkflowParentEdgeResolution => {
    const parentNode = workflow.getNode(edge.source);
    if (!parentNode) {
        return {
            resolved: true,
            active: false
        };
    }

    const parentOutput = outputs.get(parentNode.id) ?? {};

    if (parentNode.type === WorkflowNodeType.ForEach) {
        const itemCount = typeof parentOutput.count === 'number'
            ? parentOutput.count
            : Array.isArray(parentOutput.items)
                ? parentOutput.items.length
                : 0;

        return itemCount > 0
            ? {
                resolved: true,
                active: true
            }
            : {
                resolved: true,
                active: false,
                reason: `ForEach node "${parentNode.id}" produced no items`
            };
    }

    if (parentNode.type === WorkflowNodeType.IfStatement) {
        const branch = readWorkflowIfBranch(parentOutput, parentNode.id);
        return matchesIfBranchHandle(edge.sourceHandle, branch)
            ? {
                resolved: true,
                active: true
            }
            : {
                resolved: true,
                active: false,
                reason: `Node "${targetNodeId}" is not on the selected "${branch}" branch`
            };
    }

    if (parentNode.type === WorkflowNodeType.SwitchStatement) {
        if (edge.sourceHandle === 'continue') {
            return {
                resolved: true,
                active: true
            };
        }

        const matchedCaseId = typeof parentOutput.matchedCaseId === 'string'
            ? parentOutput.matchedCaseId
            : null;
        return edge.sourceHandle === 'cases' && matchedCaseId === targetNodeId
            ? {
                resolved: true,
                active: true
            }
            : {
                resolved: true,
                active: false,
                reason: matchedCaseId
                    ? `Switch statement "${parentNode.id}" selected case "${matchedCaseId}"`
                    : `Switch statement "${parentNode.id}" did not match this case`
            };
    }

    return {
        resolved: true,
        active: true
    };
};

export const resolveWorkflowRuntimeNodeState = (
    input: ResolveWorkflowRuntimeNodeStateInput
): WorkflowRuntimeNodeState => {
    const cachedState = input.nodeStateCache.get(input.nodeId);
    if (cachedState) {
        return cachedState;
    }

    if (input.resolvingNodeIds.has(input.nodeId)) {
        throw new Error(`Workflow contains a cycle near node "${input.nodeId}"`);
    }

    input.resolvingNodeIds.add(input.nodeId);
    const parentEdges = input.workflow.getParentEdges(input.nodeId);
    const nodeStatus = input.getNodeExecutionStatus(input.nodeId);

    if (parentEdges.length === 0) {
        const rootState: WorkflowRuntimeNodeState = nodeStatus === 'executed'
            ? 'active'
            : nodeStatus === 'failed' || nodeStatus === 'skipped'
                ? 'failed'
                : 'unresolved';
        input.nodeStateCache.set(input.nodeId, rootState);
        input.resolvingNodeIds.delete(input.nodeId);
        return rootState;
    }

    let hasActiveParent = false;
    let hasUnresolvedParent = false;
    let hasFailedParent = false;

    for (const edge of parentEdges) {
        const edgeState = resolveWorkflowParentEdgeState({
            workflow: input.workflow,
            outputs: input.outputs,
            getNodeExecutionStatus: input.getNodeExecutionStatus,
            edge,
            targetNodeId: input.nodeId,
            nodeStateCache: input.nodeStateCache,
            resolvingNodeIds: input.resolvingNodeIds
        });

        if (!edgeState.resolved) {
            hasUnresolvedParent = true;
            continue;
        }

        if (!edgeState.active) {
            continue;
        }

        if (edgeState.reason) {
            hasFailedParent = true;
            continue;
        }

        hasActiveParent = true;
    }

    const nodeState: WorkflowRuntimeNodeState = hasActiveParent
        ? nodeStatus === 'executed'
            ? 'active'
            : nodeStatus === 'failed' || nodeStatus === 'skipped'
                ? 'failed'
                : 'unresolved'
        : hasUnresolvedParent
            ? 'unresolved'
            : hasFailedParent
                ? 'failed'
                : 'inactive';
    input.nodeStateCache.set(input.nodeId, nodeState);
    input.resolvingNodeIds.delete(input.nodeId);

    return nodeState;
};

export const resolveWorkflowParentEdgeState = (
    input: ResolveWorkflowParentEdgeStateInput
): WorkflowParentEdgeResolution => {
    const parentState = resolveWorkflowRuntimeNodeState({
        workflow: input.workflow,
        outputs: input.outputs,
        getNodeExecutionStatus: input.getNodeExecutionStatus,
        nodeId: input.edge.source,
        nodeStateCache: input.nodeStateCache,
        resolvingNodeIds: input.resolvingNodeIds
    });

    if (parentState === 'unresolved') {
        return {
            resolved: false,
            active: false,
            reason: `Parent node "${input.edge.source}" has not executed`
        };
    }

    if (parentState === 'inactive') {
        return {
            resolved: true,
            active: false
        };
    }

    if (parentState === 'failed') {
        const status = input.getNodeExecutionStatus(input.edge.source);
        return {
            resolved: true,
            active: true,
            reason: status === 'failed'
                ? `Parent node "${input.edge.source}" failed`
                : `Parent node "${input.edge.source}" was skipped`
        };
    }

    return resolveActiveParentEdgeState(
        input.workflow,
        input.edge,
        input.targetNodeId,
        input.outputs
    );
};

export const isWorkflowRuntimeNodeReady = (
    workflow: WorkflowGraph,
    nodeId: string,
    outputs: WorkflowOutputs,
    visitedNodeIds: Set<string>
): boolean => {
    const parentEdges = workflow.getParentEdges(nodeId);
    if (parentEdges.length === 0) {
        return true;
    }

    const nodeStateCache = new Map<string, WorkflowRuntimeNodeState>();
    const resolvingNodeIds = new Set<string>();
    let hasActiveParent = false;

    for (const edge of parentEdges) {
        const edgeState = resolveWorkflowParentEdgeState({
            workflow,
            outputs,
            getNodeExecutionStatus: (currentNodeId) => visitedNodeIds.has(currentNodeId)
                ? 'executed'
                : 'pending',
            edge,
            targetNodeId: nodeId,
            nodeStateCache,
            resolvingNodeIds
        });

        if (!edgeState.resolved) {
            return false;
        }

        if (edgeState.active) {
            hasActiveParent = true;
        }
    }

    return hasActiveParent;
};

export const resolveWorkflowRuntimeChildNodeIds = (
    workflow: WorkflowGraph,
    node: WorkflowNode,
    output: Record<string, unknown>
): {
    activeNodeIds: string[];
    inactiveNodeIds: string[];
} => {
    if (node.type === WorkflowNodeType.IfStatement) {
        const branch = readWorkflowIfBranch(output, node.id);
        const activeNodeIds = workflow.getChildEdges(node.id)
            .filter((edge) => matchesIfBranchHandle(edge.sourceHandle, branch))
            .map((edge) => edge.target);

        return {
            activeNodeIds,
            inactiveNodeIds: workflow.getChildren(node.id)
                .map((childNode) => childNode.id)
                .filter((childNodeId) => !activeNodeIds.includes(childNodeId))
        };
    }

    if (node.type === WorkflowNodeType.SwitchStatement) {
        const matchedCaseId = typeof output.matchedCaseId === 'string'
            ? output.matchedCaseId
            : null;
        const continueNodeIds = workflow.getChildren(node.id, 'continue').map((childNode) => childNode.id);
        const caseNodeIds = workflow.getChildren(node.id, 'cases').map((childNode) => childNode.id);
        const matchedNodeIds = matchedCaseId
            ? caseNodeIds.filter((childNodeId) => childNodeId === matchedCaseId)
            : [];

        return {
            activeNodeIds: [...matchedNodeIds, ...continueNodeIds],
            inactiveNodeIds: caseNodeIds.filter((childNodeId) => childNodeId !== matchedCaseId)
        };
    }

    return {
        activeNodeIds: workflow.getChildren(node.id).map((childNode) => childNode.id),
        inactiveNodeIds: []
    };
};
