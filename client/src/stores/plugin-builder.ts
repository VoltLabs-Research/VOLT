import { create } from 'zustand';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { NodeType, type IWorkflow } from '@/types/plugin';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';
import { createNode } from '@/utilities/plugins/node-factory';

export interface PluginBuilderState {
    nodes: Node[];
    edges: Edge[];
    selectedNode: Node | null;

    // Actions
    setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
    setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    onNodeClick: (event: React.MouseEvent, node: Node) => void;
    onPaneClick: () => void;
    selectNode: (node: Node | null) => void;
    addNode: (type: NodeType, position: { x: number; y: number }) => void;
    updateNodeData: (nodeId: string, data: any) => void;
    deleteNode: (nodeId: string) => void;
    deleteEdge: (edgeId: string) => void;
    validateConnection: (connection: Connection) => boolean;
    getWorkflow: () => IWorkflow;
    loadWorkflow: (workflow: IWorkflow) => void;
    clearWorkflow: () => void;
}

const DEFAULT_EDGE_STYLE = {
    animated: true,
    style: { stroke: '#64748b', strokeWidth: 2 }
};

const usePluginBuilderStore = create<PluginBuilderState>((set, get) => ({
    nodes: [],
    edges: [],
    selectedNode: null,

    setNodes: (nodesOrUpdater) => {
        if (typeof nodesOrUpdater === 'function') {
            set((state) => ({ nodes: nodesOrUpdater(state.nodes) }));
        } else {
            set({ nodes: nodesOrUpdater });
        }
    },

    setEdges: (edgesOrUpdater) => {
        if (typeof edgesOrUpdater === 'function') {
            set((state) => ({ edges: edgesOrUpdater(state.edges) }));
        } else {
            set({ edges: edgesOrUpdater });
        }
    },

    onNodesChange: (changes) => {
        set((state) => ({
            nodes: applyNodeChanges(changes, state.nodes)
        }));
    },

    onEdgesChange: (changes) => {
        set((state) => ({
            edges: applyEdgeChanges(changes, state.edges)
        }));
    },

    validateConnection: (connection) => {
        const { nodes, edges } = get();
        if (!connection.source || !connection.target) return false;

        const sourceNode = nodes.find((node) => node.id === connection.source);
        const targetNode = nodes.find((node) => node.id === connection.target);
        if (!sourceNode || !targetNode) return false;

        const sourceConfig = NODE_CONFIGS[sourceNode.type as NodeType];
        const canConnect = sourceConfig.allowedConnections.to.includes(targetNode.type as NodeType);
        const alreadyConnected = edges.some(
            (edge) => edge.source === connection.source && edge.target === connection.target
        );
        const targetHasInput = edges.some((edge) => edge.target === connection.target);

        return canConnect && !alreadyConnected && !targetHasInput;
    },

    onConnect: (connection) => {
        const { validateConnection } = get();
        if (!validateConnection(connection)) return;

        const newEdge: Edge = {
            id: `e-${connection.source}-${connection.target}`,
            source: connection.source!,
            target: connection.target!,
            sourceHandle: connection.sourceHandle || undefined,
            targetHandle: connection.targetHandle || undefined,
            ...DEFAULT_EDGE_STYLE
        };

        set((state) => ({
            edges: addEdge(newEdge, state.edges)
        }));
    },

    onNodeClick: (_event, node) => {
        set({ selectedNode: node });
    },

    onPaneClick: () => {
        set({ selectedNode: null });
    },

    selectNode: (node) => {
        set({ selectedNode: node });
    },

    addNode: (type, position) => {
        const newNode = createNode(type, position);
        set((state) => ({
            nodes: [...state.nodes, newNode]
        }));
    },

    updateNodeData: (nodeId, data) => {
        set((state) => {
            const updatedNodes = state.nodes.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, ...data } };
                }
                return node;
            });

            const updatedSelectedNode = state.selectedNode?.id === nodeId
                ? { ...state.selectedNode, data: { ...state.selectedNode.data, ...data } }
                : state.selectedNode;

            return {
                nodes: updatedNodes,
                selectedNode: updatedSelectedNode
            };
        });
    },

    deleteNode: (nodeId) => {
        set((state) => ({
            nodes: state.nodes.filter((node) => node.id !== nodeId),
            edges: state.edges.filter(
                (edge) => edge.source !== nodeId && edge.target !== nodeId
            ),
            selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode
        }));
    },

    deleteEdge: (edgeId) => {
        set((state) => ({
            edges: state.edges.filter((edge) => edge.id !== edgeId)
        }));
    },

    getWorkflow: () => {
        const { nodes, edges } = get();
        return {
            nodes: nodes.map((node) => ({
                id: node.id,
                name: (node.data.name as string) || node.id,
                type: node.type as NodeType,
                position: node.position,
                data: {
                    modifier: node.data.modifier,
                    arguments: node.data.arguments,
                    context: node.data.context,
                    forEach: node.data.forEach,
                    entrypoint: node.data.entrypoint,
                    exposure: node.data.exposure,
                    schema: node.data.schema,
                    visualizers: node.data.visualizers,
                    export: node.data.export
                }
            })) as IWorkflow['nodes'],
            edges: edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle ?? undefined,
                targetHandle: edge.targetHandle ?? undefined
            })),
            viewport: { x: 0, y: 0, zoom: 1 }
        };
    },

    loadWorkflow: (workflow) => {
        set({
            nodes: workflow.nodes.map((node) => ({
                id: node.id,
                type: node.type,
                position: node.position,
                data: { name: node.name, ...node.data }
            })),
            edges: workflow.edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle,
                ...DEFAULT_EDGE_STYLE
            })),
            selectedNode: null
        });
    },

    clearWorkflow: () => {
        set({
            nodes: [],
            edges: [],
            selectedNode: null
        });
    }
}));

export default usePluginBuilderStore;
