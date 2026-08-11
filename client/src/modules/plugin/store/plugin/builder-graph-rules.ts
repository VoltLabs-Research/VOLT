import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { Connection, Edge, Node } from '@xyflow/react';
import type { INodeData } from '@volt/contracts/modules/plugin/workflow';

const UNLIMITED_CONNECTIONS = -1;

const countEdges = (edges: Edge[], side: 'source' | 'target', nodeId: string): number => {
    return edges.filter((edge) => edge[side] === nodeId).length;
};

export const isConnectionAllowed = (
    nodes: Node<INodeData>[],
    edges: Edge[],
    connection: Connection
): boolean => {
    const { source, target } = connection;

    if (!source || !target || source === target) return false;

    const sourceType = nodes.find((node) => node.id === source)?.type as NodeType | undefined;
    const targetType = nodes.find((node) => node.id === target)?.type as NodeType | undefined;

    if (!sourceType || !targetType) return false;

    const sourceConfig = NODE_CONFIGS[sourceType];
    const targetConfig = NODE_CONFIGS[targetType];

    if (!sourceConfig || !targetConfig) return false;
    if (!sourceConfig.allowedConnections.to.includes(targetType)) return false;
    if (!targetConfig.allowedConnections.from.includes(sourceType)) return false;
    if (edges.some((edge) => edge.source === source && edge.target === target)) return false;

    if (targetConfig.inputs !== UNLIMITED_CONNECTIONS && countEdges(edges, 'target', target) >= targetConfig.inputs) {
        return false;
    }

    if (sourceConfig.outputs !== UNLIMITED_CONNECTIONS && countEdges(edges, 'source', source) >= sourceConfig.outputs) {
        return false;
    }

    return true;
};

export const collectWorkflowErrors = (nodes: Node<INodeData>[], edges: Edge[]): string[] => {
    const modifierNodeIds = new Set(
        nodes.filter((node) => node.type === NodeType.MODIFIER).map((node) => node.id)
    );

    if (modifierNodeIds.size === 0) {
        return ['Missing Modifier node — required as the plugin entry point.'];
    }

    const hasModifierOutput = edges.some((edge) => modifierNodeIds.has(edge.source));

    if (!hasModifierOutput && nodes.length > 1) {
        return ['Modifier node has no outgoing connections.'];
    }

    return [];
};
