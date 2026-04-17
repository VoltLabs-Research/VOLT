import { matchesIfBranchHandle, WorkflowGraph, WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNode } from '@/modules/analysis/contracts/workflow.types';

export const readWorkflowIfBranch = (
    output: Record<string, unknown>,
    nodeId: string
): 'true' | 'false' => {
    if (output.branch === 'true' || output.branch === 'false') {
        return output.branch;
    }

    throw new Error(`IfStatement node "${nodeId}" produced an invalid branch result`);
};

type WorkflowRuntimeEdgeState = 'active' | 'inactive' | 'unresolved';

const getWorkflowRuntimeEdgeState = (
    workflow: WorkflowGraph,
    edgeIndex: number,
    targetNodeId: string,
    outputs: Map<string, Record<string, unknown>>,
    visitedNodeIds: Set<string>,
    nodeStateCache: Map<string, WorkflowRuntimeEdgeState>,
    resolvingNodeIds: Set<string>
): WorkflowRuntimeEdgeState => {
    const edge = workflow.edges[edgeIndex];
    const parentState = getWorkflowRuntimeNodeState(
        workflow,
        edge.source,
        outputs,
        visitedNodeIds,
        nodeStateCache,
        resolvingNodeIds
    );
    if (parentState !== 'active') {
        return parentState;
    }

    const parentNode = workflow.nodes.find((candidate) => candidate.id === edge.source);
    if (!parentNode) {
        return 'inactive';
    }

    const parentOutput = outputs.get(parentNode.id) ?? {};

    if (parentNode.type === WorkflowNodeType.ForEach) {
        const itemCount = typeof parentOutput.count === 'number'
            ? parentOutput.count
            : Array.isArray(parentOutput.items)
                ? parentOutput.items.length
                : 0;

        return itemCount > 0 ? 'active' : 'inactive';
    }

    if (parentNode.type === WorkflowNodeType.IfStatement) {
        const branch = readWorkflowIfBranch(parentOutput, parentNode.id);
        return matchesIfBranchHandle(edge.sourceHandle, branch)
            ? 'active'
            : 'inactive';
    }

    if (parentNode.type === WorkflowNodeType.SwitchStatement) {
        if (edge.sourceHandle === 'continue') {
            return 'active';
        }

        return edge.sourceHandle === 'cases' && parentOutput.matchedCaseId === targetNodeId
            ? 'active'
            : 'inactive';
    }

    return 'active';
};

const getWorkflowRuntimeNodeState = (
    workflow: WorkflowGraph,
    nodeId: string,
    outputs: Map<string, Record<string, unknown>>,
    visitedNodeIds: Set<string>,
    nodeStateCache: Map<string, WorkflowRuntimeEdgeState>,
    resolvingNodeIds: Set<string>
): WorkflowRuntimeEdgeState => {
    const cachedState = nodeStateCache.get(nodeId);
    if (cachedState) {
        return cachedState;
    }

    if (resolvingNodeIds.has(nodeId)) {
        throw new Error(`Workflow contains a cycle near node "${nodeId}"`);
    }

    resolvingNodeIds.add(nodeId);

    const parentEdgeIndexes = workflow.edges
        .map((edge, index) => ({ edge, index }))
        .filter((entry) => entry.edge.target === nodeId)
        .map((entry) => entry.index);

    if (parentEdgeIndexes.length === 0) {
        const rootState = visitedNodeIds.has(nodeId)
            ? 'active'
            : 'unresolved';
        nodeStateCache.set(nodeId, rootState);
        resolvingNodeIds.delete(nodeId);
        return rootState;
    }

    let hasActiveParent = false;
    let hasUnresolvedParent = false;

    for (const edgeIndex of parentEdgeIndexes) {
        const edgeState = getWorkflowRuntimeEdgeState(
            workflow,
            edgeIndex,
            nodeId,
            outputs,
            visitedNodeIds,
            nodeStateCache,
            resolvingNodeIds
        );

        if (edgeState === 'active') {
            hasActiveParent = true;
            continue;
        }

        if (edgeState === 'unresolved') {
            hasUnresolvedParent = true;
        }
    }

    const nodeState = hasActiveParent
        ? (visitedNodeIds.has(nodeId) ? 'active' : 'unresolved')
        : hasUnresolvedParent
            ? 'unresolved'
            : 'inactive';
    nodeStateCache.set(nodeId, nodeState);
    resolvingNodeIds.delete(nodeId);

    return nodeState;
};

export const isWorkflowRuntimeNodeReady = (
    workflow: WorkflowGraph,
    nodeId: string,
    outputs: Map<string, Record<string, unknown>>,
    visitedNodeIds: Set<string>
): boolean => {
    const parentEdges = workflow.edges.filter((edge) => edge.target === nodeId);
    if (parentEdges.length === 0) {
        return true;
    }

    const nodeStateCache = new Map<string, WorkflowRuntimeEdgeState>();
    const resolvingNodeIds = new Set<string>();
    let hasActiveParent = false;

    for (const edgeIndex of workflow.edges
        .map((edge, index) => ({ edge, index }))
        .filter((entry) => entry.edge.target === nodeId)
        .map((entry) => entry.index)) {
        const edgeState = getWorkflowRuntimeEdgeState(
            workflow,
            edgeIndex,
            nodeId,
            outputs,
            visitedNodeIds,
            nodeStateCache,
            resolvingNodeIds
        );

        if (edgeState === 'unresolved') {
            return false;
        }

        if (edgeState === 'active') {
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
        const activeNodeIds = workflow.getChildren(node.id)
            .filter((childNode) => {
                const edge = workflow.edges.find((candidate) => {
                    return candidate.source === node.id && candidate.target === childNode.id;
                });

                return matchesIfBranchHandle(edge?.sourceHandle, branch);
            })
            .map((childNode) => childNode.id);

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
