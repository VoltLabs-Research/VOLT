import {
    EntrypointNodeData,
    WorkflowEdge,
    WorkflowNode,
    WorkflowNodeType
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';

export interface WorkflowViewport {
    x: number;
    y: number;
    zoom: number;
}

export interface WorkflowProps {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    viewport?: WorkflowViewport;
}

export default class Workflow {
    constructor(
        public id: string,
        public props: WorkflowProps
    ) {}

    updateEntrypoint(update: Partial<EntrypointNodeData>) {
        const entrypointNode = this.props.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        if (!entrypointNode || !entrypointNode.data?.entrypoint) {
            return;
        }

        entrypointNode.data.entrypoint = {
            ...entrypointNode.data.entrypoint,
            ...update
        };
    }

    findDescendantByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null {
        const nodeMap = new Map(this.props.nodes.map((node) => [node.id, node]));
        const childAdjacency = new Map<string, string[]>();
        for (const edge of this.props.edges) {
            const adj = childAdjacency.get(edge.source) || [];
            adj.push(edge.target);
            childAdjacency.set(edge.source, adj);
        }

        const visited = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            for (const childId of childAdjacency.get(currentId) || []) {
                const childNode = nodeMap.get(childId);
                if (childNode?.type === type) return childNode;
                if (childNode) queue.push(childId);
            }
        }

        return null;
    }
}
