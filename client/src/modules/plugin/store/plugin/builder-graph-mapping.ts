import { NodeType, PluginNodeExecutionMode } from '@volt/contracts/modules/plugin/enums';
import type { Edge, Node, XYPosition } from '@xyflow/react';
import type { INodeData, IWorkflow, IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';

export const DEFAULT_EDGE_STYLE = {
    animated: true,
    style: {
        stroke: '#64748b',
        strokeWidth: 2
    }
};

interface GraphNodeSource {
    id: string;
    type?: string;
    position: XYPosition;
    data: INodeData;
}

interface GraphEdgeSource {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

export const toBuilderNodes = (nodes: GraphNodeSource[]): Node<INodeData>[] => {
    return nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data
    }));
};

export const toBuilderEdges = (edges: GraphEdgeSource[]): Edge[] => {
    return edges.map((edge) => ({
        ...toWorkflowEdge(edge),
        ...DEFAULT_EDGE_STYLE
    }));
};

const toWorkflowEdge = (edge: GraphEdgeSource): IWorkflow['edges'][number] => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined
});

export const toWorkflowEdges = (edges: GraphEdgeSource[]): IWorkflow['edges'] => edges.map(toWorkflowEdge);

const toWorkflowPluginNode = (node: Node<INodeData>): INodeData => {
    const pluginNode = node.type === NodeType.PLUGIN ? node.data.pluginNode : undefined;

    if (!pluginNode) {
        return node.data;
    }

    const pluginId = pluginNode.pluginId?.trim() ?? '';
    const argumentReference = pluginNode.argumentReference?.trim() ?? '';

    return {
        ...node.data,
        pluginNode: {
            ...pluginNode,
            pluginId,
            argumentReference,
            executionMode: pluginNode.executionMode ?? (
                !pluginId && argumentReference
                    ? PluginNodeExecutionMode.ARGUMENT_REFERENCE
                    : PluginNodeExecutionMode.MANUAL
            )
        }
    };
};

export const toWorkflowNodes = (nodes: Node<INodeData>[]): IWorkflowNode[] => {
    return nodes.map((node) => ({
        id: node.id,
        type: node.type as NodeType,
        position: {
            x: node.position.x,
            y: node.position.y
        },
        data: toWorkflowPluginNode(node)
    }));
};
