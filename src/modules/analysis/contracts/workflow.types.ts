import type { DaemonAnalysisDocument, TrajectoryDumpDescriptor, TrajectoryFrame, WorkflowEdgeDefinition, WorkflowDefinition } from '@/contracts';
import type { WorkflowNodeData } from '@/contracts';

export enum WorkflowNodeType {
    Modifier = 'modifier',
    Arguments = 'arguments',
    Context = 'context',
    ForEach = 'forEach',
    Entrypoint = 'entrypoint',
    Plugin = 'plugin-node',
    Exposure = 'exposure',
    Export = 'export',
    IfStatement = 'if-statement',
    SwitchStatement = 'switch-statement',
    SwitchCase = 'switch-case'
}

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: {
        x: number;
        y: number;
    };
    data: WorkflowNodeData;
}

export type WorkflowEdge = WorkflowEdgeDefinition;

export interface WorkflowExecutionContext {
    outputs: Map<string, Record<string, unknown>>;
    userConfig: Record<string, unknown>;
    runtimeArguments: Record<string, unknown>;
    trajectoryId: string;
    trajectoryFrames: TrajectoryFrame[];
    trajectoryDumpOverrides?: TrajectoryDumpDescriptor[];
    analysis: DaemonAnalysisDocument;
    analysisId: string;
    generatedFiles: string[];
    pluginId: string;
    teamId: string;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    selectedTimestep?: number;
    workflow: WorkflowGraph;
    nestedWorkflows: Map<string, WorkflowDefinition>;
}

export const matchesIfBranchHandle = (
    edgeHandle: string | undefined,
    selectedBranch: string
): boolean => {
    if (selectedBranch === 'true') {
        return edgeHandle === 'output-true' || edgeHandle === 'true';
    }

    return edgeHandle === 'output-false' || edgeHandle === 'false';
};

export class WorkflowGraph {
    constructor(public readonly definition: WorkflowDefinition) {}

    get nodes(): WorkflowNode[] {
        return this.definition.nodes as WorkflowNode[];
    }

    get edges(): WorkflowEdge[] {
        return this.definition.edges as WorkflowEdge[];
    }

    getChildren(nodeId: string, sourceHandle?: string): WorkflowNode[] {
        return this.edges
            .filter((edge) => edge.source === nodeId && (typeof sourceHandle === 'undefined' || edge.sourceHandle === sourceHandle))
            .map((edge) => this.nodes.find((candidate) => candidate.id === edge.target))
            .filter((candidate): candidate is WorkflowNode => Boolean(candidate));
    }

    findRuntimeRootNode(): WorkflowNode | null {
        return this.nodes.find((node) => node.type === WorkflowNodeType.ForEach)
            ?? this.nodes.find((node) => node.type === WorkflowNodeType.Context)
            ?? this.nodes.find((node) => node.type === WorkflowNodeType.Arguments)
            ?? this.nodes.find((node) => node.type === WorkflowNodeType.Modifier)
            ?? null;
    }

    getRuntimeRootNodes(): WorkflowNode[] {
        const runtimeRootNode = this.findRuntimeRootNode();
        if (!runtimeRootNode) {
            return [];
        }

        return this.getChildren(runtimeRootNode.id);
    }

    getRuntimeRootNodeIds(): string[] {
        return this.getRuntimeRootNodes().map((node) => node.id);
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
            const currentId = queue.shift();
            if (!currentId) {
                continue;
            }

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
            const currentId = queue.shift();
            if (!currentId) {
                continue;
            }

            if (visited.has(currentId)) {
                continue;
            }
            visited.add(currentId);

            for (const childNode of this.getChildren(currentId)) {
                if (childNode?.type === type) {
                    return childNode;
                }
                if (childNode) {
                    queue.push(childNode.id);
                }
            }
        }

        return null;
    }

    findDescendantNodesOnBranch(startNodeId: string, sourceHandle: string): string[] {
        const result: string[] = [];
        const visited = new Set<string>();
        const initialChildren = this.getChildren(startNodeId, sourceHandle).map((node) => node.id);
        const queue = [...initialChildren];

        while (queue.length > 0) {
            const nodeId = queue.shift();
            if (!nodeId) {
                continue;
            }

            if (visited.has(nodeId)) {
                continue;
            }

            visited.add(nodeId);
            result.push(nodeId);
            const downstreamChildren = this.getChildren(nodeId).map((node) => node.id);
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
            const nodeId = queue.shift();
            if (!nodeId) {
                continue;
            }

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
};
