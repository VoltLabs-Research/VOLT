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

/** Shared by stored workflows and by the canvas graph itself. */
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

/**
 * Strips a graph down to the fields the builder owns, dropping the transient
 * flags xyflow attaches to live nodes (measurements, drag and selection state).
 */
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

/**
 * A plugin node can either name its plugin outright or resolve it from an
 * argument at runtime. Persisting the mode explicitly — inferred from which of
 * the two fields is filled in when the editor never set it — keeps the runtime
 * from having to guess.
 */
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
