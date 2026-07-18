import { EntrypointNodeData } from './nodes/EntrypointNode';
import { WorkflowEdge } from './WorkflowEdge';
import { WorkflowNode, WorkflowNodeType } from './WorkflowNode';

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

    /**
     * Find any ancestor node of specified type (BFS).
     */
    findAncestorByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null {
        const nodeMap = new Map(this.props.nodes.map((node) => [node.id, node]));
        const parentAdjacency = new Map<string, string[]>();
        for (const edge of this.props.edges) {
            const adj = parentAdjacency.get(edge.target) || [];
            adj.push(edge.source);
            parentAdjacency.set(edge.target, adj);
        }

        const visited = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            for (const parentId of parentAdjacency.get(currentId) || []) {
                const parentNode = nodeMap.get(parentId);
                if (parentNode?.type === type) return parentNode;
                queue.push(parentId);
            }
        }

        return null;
    }

    /**
     * Find descendant node of specified type (BFS)
     */
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

    topologicalSort(): WorkflowNode[] {
        const nodeMap = new Map(this.props.nodes.map((node) => [node.id, node]));
        const inDegree = new Map<string, number>();
        const adjacency = new Map<string, string[]>();

        for (const node of this.props.nodes) {
            inDegree.set(node.id, 0);
            adjacency.set(node.id, []);
        }

        for (const edge of this.props.edges) {
            const adj = adjacency.get(edge.source) || [];
            adj.push(edge.target);
            adjacency.set(edge.source, adj);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }

        const queue: string[] = [];
        for (const [id, degree] of inDegree) {
            if (degree === 0) queue.push(id);
        }

        const result: WorkflowNode[] = [];
        while (queue.length > 0) {
            const nodeId = queue.shift()!;
            const node = nodeMap.get(nodeId);
            if (node) result.push(node);

            for (const neighbor of adjacency.get(nodeId) || []) {
                const newDegree = (inDegree.get(neighbor) || 0) - 1;
                inDegree.set(neighbor, newDegree);
                if (newDegree === 0) queue.push(neighbor);
            }
        }

        return result;
    }
}
