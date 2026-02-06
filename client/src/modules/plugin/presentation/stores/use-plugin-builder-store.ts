import { create } from 'zustand';
import type { Node, Edge, Connection, NodeChange, EdgeChange, XYPosition } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { IWorkflow, INodeData, NodeType } from '../../domain/entities';
import { NODE_CONFIGS } from '../utilities/node-types';
import { createNode } from '../utilities/node-factory';

type ValidationResult = {
    valid: boolean;
    errors: string[];
};

type NodesUpdater = Node<INodeData>[] | ((prev: Node<INodeData>[]) => Node<INodeData>[]);
type EdgesUpdater = Edge[] | ((prev: Edge[]) => Edge[]);

const DEFAULT_EDGE_STYLE = { animated: true, style: { stroke: '#64748b', strokeWidth: 2 } };

interface PluginBuilderState {
    nodes: Node<INodeData>[];
    edges: Edge[];
    selectedNode: Node<INodeData> | null;
    currentPluginId: string | null;
    isSaving: boolean;
    isLoading: boolean;
    saveError: string | null;
    loadError: string | null;
    validationResult: ValidationResult | null;
};

interface PluginBuilderActions {
    setNodes: (nodesOrUpdater: NodesUpdater) => void;
    setEdges: (edgesOrUpdater: EdgesUpdater) => void;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    validateConnection: (connection: Connection) => boolean;
    onConnect: (connection: Connection) => void;
    onNodeClick: (_event: unknown, node: Node<INodeData>) => void;
    onPaneClick: () => void;
    selectNode: (node: Node<INodeData> | null) => void;
    addNode: (type: NodeType, position: XYPosition) => void;
    updateNodeData: (nodeId: string, data: Partial<INodeData>) => void;
    deleteNode: (nodeId: string) => void;
    deleteEdge: (edgeId: string) => void;
    getWorkflow: () => IWorkflow;
    loadWorkflow: (workflow: IWorkflow) => void;
    clearWorkflow: () => void;
    setCurrentPluginId: (id: string | null) => void;
    setSaving: (value: boolean) => void;
    setLoading: (value: boolean) => void;
    setSaveError: (error: string | null) => void;
    setLoadError: (error: string | null) => void;
    setValidationResult: (result: ValidationResult | null) => void;
    reset: () => void;
};

type PluginBuilderStore = PluginBuilderState & PluginBuilderActions;

const initialState: PluginBuilderState = {
    nodes: [],
    edges: [],
    selectedNode: null,
    currentPluginId: null,
    isSaving: false,
    isLoading: false,
    saveError: null,
    loadError: null,
    validationResult: null
};

const usePluginBuilderStore = create<PluginBuilderStore>((set, get) => ({
    ...initialState,

    setNodes: (nodesOrUpdater) => {
        set(typeof nodesOrUpdater === 'function'
            ? (s) => ({ nodes: nodesOrUpdater(s.nodes) })
            : { nodes: nodesOrUpdater });
    },

    setEdges: (edgesOrUpdater) => {
        set(typeof edgesOrUpdater === 'function'
            ? (s) => ({ edges: edgesOrUpdater(s.edges) })
            : { edges: edgesOrUpdater });
    },

    onNodesChange: (changes) => set((s) => ({
        nodes: applyNodeChanges(changes, s.nodes) as Node<INodeData>[]
    })),

    onEdgesChange: (changes) => set((s) => ({
        edges: applyEdgeChanges(changes, s.edges)
    })),

    validateConnection(connection) {
        const { nodes, edges } = get();
        const { source, target } = connection;

        if (!source || !target || source === target) return false;

        const srcNode = nodes.find((n) => n.id === source);
        const tgtNode = nodes.find((n) => n.id === target);

        if (!srcNode?.type || !tgtNode?.type) return false;

        const srcConfig = NODE_CONFIGS[srcNode.type as NodeType];
        const tgtConfig = NODE_CONFIGS[tgtNode.type as NodeType];

        if (!srcConfig || !tgtConfig) return false;
        if (!srcConfig.allowedConnections.to.includes(tgtNode.type as NodeType)) return false;
        if (edges.some((e) => e.source === source && e.target === target)) return false;

        const tgtLimit = typeof tgtConfig.inputs === 'number' ? tgtConfig.inputs : 1;
        if (tgtLimit !== -1 && edges.filter((e) => e.target === target).length >= tgtLimit) return false;

        const srcLimit = srcConfig.outputs;
        if (srcLimit !== -1 && edges.filter((e) => e.source === source).length >= srcLimit) return false;

        return true;
    },

    onConnect(connection) {
        if (!get().validateConnection(connection)) return;

        const edge: Edge = {
            id: `e-${connection.source}-${connection.target}-${connection.sourceHandle ?? 's'}-${connection.targetHandle ?? 't'}`,
            source: connection.source!,
            target: connection.target!,
            sourceHandle: connection.sourceHandle ?? undefined,
            targetHandle: connection.targetHandle ?? undefined,
            ...DEFAULT_EDGE_STYLE
        };

        set((s) => ({ edges: addEdge(edge, s.edges) }));
    },

    onNodeClick: (_, node) => set({ selectedNode: node }),

    onPaneClick: () => set({ selectedNode: null }),

    selectNode: (node) => set({ selectedNode: node }),

    addNode: (type, position) => set((s) => ({
        nodes: [...s.nodes, createNode(type, position)]
    })),

    updateNodeData(nodeId, data) {
        set((s) => {
            const nodes = s.nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
            );
            const selectedNode = s.selectedNode?.id === nodeId
                ? { ...s.selectedNode, data: { ...s.selectedNode.data, ...data } }
                : s.selectedNode;
            return { nodes, selectedNode };
        });
    },

    deleteNode: (nodeId) => set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== nodeId),
        edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        selectedNode: s.selectedNode?.id === nodeId ? null : s.selectedNode
    })),

    deleteEdge: (edgeId) => set((s) => ({
        edges: s.edges.filter((e) => e.id !== edgeId)
    })),

    getWorkflow() {
        const { nodes, edges } = get();

        return {
            nodes: nodes.map((n) => ({
                id: n.id,
                type: n.type as NodeType,
                position: n.position,
                data: n.data
            })),
            edges: edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle ?? undefined,
                targetHandle: e.targetHandle ?? undefined
            })),
            viewport: { x: 0, y: 0, zoom: 1 }
        };
    },

    loadWorkflow(workflow) {
        set({
            nodes: workflow.nodes.map((n) => ({
                id: n.id,
                type: n.type,
                position: n.position,
                data: n.data
            })) as Node<INodeData>[],
            edges: workflow.edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle,
                ...DEFAULT_EDGE_STYLE
            })),
            selectedNode: null,
            validationResult: null,
            saveError: null,
            loadError: null
        });
    },

    clearWorkflow: () => set(initialState),

    setCurrentPluginId: (id) => set({ currentPluginId: id }),

    setSaving: (value) => set({ isSaving: value }),

    setLoading: (value) => set({ isLoading: value }),

    setSaveError: (error) => set({ saveError: error }),

    setLoadError: (error) => set({ loadError: error }),

    setValidationResult: (result) => set({ validationResult: result }),

    reset: () => set(initialState)
}));

export { usePluginBuilderStore };
export default usePluginBuilderStore;
