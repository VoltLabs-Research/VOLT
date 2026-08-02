import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import type {
    WorkflowEdge,
    WorkflowNode,
    WorkflowNodeType
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';

export interface WorkflowTopologyIndex {
    nodeMap: Map<string, WorkflowNode>;
    parentsByTarget: Map<string, WorkflowEdge[]>;
    childrenBySource: Map<string, WorkflowEdge[]>;
}

const appendEdge = (bucket: Map<string, WorkflowEdge[]>, key: string, edge: WorkflowEdge): void => {
    const existing = bucket.get(key);
    if (existing) {
        existing.push(edge);
        return;
    }

    bucket.set(key, [edge]);
};

export const buildWorkflowTopologyIndex = (workflow: WorkflowProps): WorkflowTopologyIndex => {
    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of workflow.nodes) {
        nodeMap.set(node.id, node);
    }

    const parentsByTarget = new Map<string, WorkflowEdge[]>();
    const childrenBySource = new Map<string, WorkflowEdge[]>();
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
    ancestorTypes: ReadonlySet<WorkflowNodeType>
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

export const hasWorkflowCycle = (nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean => {
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
