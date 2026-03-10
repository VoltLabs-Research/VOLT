import type { WorkflowDefinition } from '../../../shared/contracts';

export enum WorkflowNodeType {
    Modifier = 'modifier',
    Arguments = 'arguments',
    Context = 'context',
    ForEach = 'forEach',
    Entrypoint = 'entrypoint',
    Exposure = 'exposure',
    Export = 'export',
    IfStatement = 'if-statement'
}

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: {
        x: number;
        y: number;
    };
    data: Record<string, unknown>;
}

export interface WorkflowEdge {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

export interface WorkflowExecutionContext {
    outputs: Map<string, Record<string, unknown>>;
    userConfig: Record<string, unknown>;
    trajectoryId: string;
    trajectoryFrames: Array<{ timestep: number; natoms: number; simulationCell: string; }>;
    analysisId: string;
    generatedFiles: string[];
    pluginId: string;
    teamId: string;
    selectedFrameOnly?: boolean;
    selectedTimestep?: number;
    workflow: WorkflowGraph;
}

export class WorkflowGraph {
    constructor(public readonly definition: WorkflowDefinition) {}

    get nodes(): WorkflowNode[] {
        return this.definition.nodes as WorkflowNode[];
    }

    get edges(): WorkflowEdge[] {
        return this.definition.edges as WorkflowEdge[];
    }

    findParentByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null {
        const parentEdge = this.edges.find((edge) => edge.target === nodeId);
        if (!parentEdge) {
            return null;
        }

        const parentNode = this.nodes.find((node) => node.id === parentEdge.source) || null;
        if (parentNode?.type === type) {
            return parentNode;
        }

        return this.findParentByType(parentEdge.source, type);
    }

    findAncestorByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null {
        const visited = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
            const currentId = queue.shift() as string;
            if (visited.has(currentId)) {
                continue;
            }
            visited.add(currentId);

            const parentEdges = this.edges.filter((edge) => edge.target === currentId);
            for (const edge of parentEdges) {
                const parentNode = this.nodes.find((node) => node.id === edge.source) || null;
                if (parentNode?.type === type) {
                    return parentNode;
                }
                queue.push(edge.source);
            }
        }

        return null;
    }

    findDescendantByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null {
        const visited = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
            const currentId = queue.shift() as string;
            if (visited.has(currentId)) {
                continue;
            }
            visited.add(currentId);

            const childEdges = this.edges.filter((edge) => edge.source === currentId);
            for (const edge of childEdges) {
                const childNode = this.nodes.find((node) => node.id === edge.target) || null;
                if (childNode?.type === type) {
                    return childNode;
                }
                if (childNode) {
                    queue.push(edge.target);
                }
            }
        }

        return null;
    }

    findDescendantNodesOnBranch(startNodeId: string, sourceHandle: string): string[] {
        const result: string[] = [];
        const visited = new Set<string>();
        const initialChildren = this.edges
            .filter((edge) => edge.source === startNodeId && edge.sourceHandle === sourceHandle)
            .map((edge) => edge.target);
        const queue = [...initialChildren];

        while (queue.length > 0) {
            const nodeId = queue.shift() as string;
            if (visited.has(nodeId)) {
                continue;
            }

            visited.add(nodeId);
            result.push(nodeId);
            const downstreamChildren = this.edges
                .filter((edge) => edge.source === nodeId)
                .map((edge) => edge.target);
            queue.push(...downstreamChildren);
        }

        return result;
    }

    topologicalSort(): WorkflowNode[] {
        const nodeMap = new Map(this.nodes.map((node) => [node.id, node]));
        const inDegree = new Map<string, number>();
        const adjacency = new Map<string, string[]>();

        for (const node of this.nodes) {
            inDegree.set(node.id, 0);
            adjacency.set(node.id, []);
        }

        for (const edge of this.edges) {
            const neighbors = adjacency.get(edge.source) || [];
            neighbors.push(edge.target);
            adjacency.set(edge.source, neighbors);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }

        const queue: string[] = [];
        for (const [id, degree] of inDegree.entries()) {
            if (degree === 0) {
                queue.push(id);
            }
        }

        const result: WorkflowNode[] = [];
        while (queue.length > 0) {
            const nodeId = queue.shift() as string;
            const node = nodeMap.get(nodeId);
            if (node) {
                result.push(node);
            }

            for (const neighbor of adjacency.get(nodeId) || []) {
                const newDegree = (inDegree.get(neighbor) || 0) - 1;
                inDegree.set(neighbor, newDegree);
                if (newDegree === 0) {
                    queue.push(neighbor);
                }
            }
        }

        return result;
    }
}
