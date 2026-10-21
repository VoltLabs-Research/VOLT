import type { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflowEdge, IWorkflowNode, IWorkflow } from '@volt/contracts/modules/plugin/workflow';

export interface WorkflowTopologyIndex {
    nodeMap: Map<string, IWorkflowNode>;
    parentsByTarget: Map<string, IWorkflowEdge[]>;
    childrenBySource: Map<string, IWorkflowEdge[]>;
}

const appendEdge = (bucket: Map<string, IWorkflowEdge[]>, key: string, edge: IWorkflowEdge): void => {
    const existing = bucket.get(key);
    if (existing) {
        existing.push(edge);
        return;
    }

    bucket.set(key, [edge]);
};

export const buildWorkflowTopologyIndex = (workflow: IWorkflow): WorkflowTopologyIndex => {
    const nodeMap = new Map<string, IWorkflowNode>();
    for (const node of workflow.nodes) {
        nodeMap.set(node.id, node);
    }

    const parentsByTarget = new Map<string, IWorkflowEdge[]>();
    const childrenBySource = new Map<string, IWorkflowEdge[]>();
    for (const edge of workflow.edges) {
        appendEdge(parentsByTarget, edge.target, edge);
        appendEdge(childrenBySource, edge.source, edge);
    }

    return {
        nodeMap,
        parentsByTarget,
        childrenBySource
    };
};

export const hasAncestorOfType = (
    nodeId: string,
    topology: WorkflowTopologyIndex,
    ancestorTypes: ReadonlySet<NodeType>
): boolean => {
    const { nodeMap, parentsByTarget } = topology;
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
        const currentNodeId = queue.shift() as string;
        if (visited.has(currentNodeId)) {
            continue;
        }

        visited.add(currentNodeId);
        for (const edge of parentsByTarget.get(currentNodeId) ?? []) {
            const parentNode = nodeMap.get(edge.source);
            if (!parentNode) {
                continue;
            }

            if (ancestorTypes.has(parentNode.type)) {
                return true;
            }

            queue.push(parentNode.id);
        }
    }

    return false;
};

export const hasWorkflowCycle = (nodes: IWorkflowNode[], edges: IWorkflowEdge[]): boolean => {
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
        adjacency.set(node.id, []);
    }

    for (const edge of edges) {
        adjacency.get(edge.source)?.push(edge.target);
    }

    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
        visited.add(nodeId);
        stack.add(nodeId);

        for (const neighbor of adjacency.get(nodeId) ?? []) {
            if (!visited.has(neighbor)) {
                if (dfs(neighbor)) return true;
            } else if (stack.has(neighbor)) {
                return true;
            }
        }

        stack.delete(nodeId);
        return false;
    };

    for (const node of nodes) {
        if (!visited.has(node.id)) {
            if (dfs(node.id)) return true;
        }
    }

    return false;
};
