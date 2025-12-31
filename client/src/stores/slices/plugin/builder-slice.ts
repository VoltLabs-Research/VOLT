import { create } from 'zustand';
import type { Node, Edge, Connection, NodeChange, EdgeChange, XYPosition } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { NodeType, type IWorkflow } from '@/types/plugin';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';
import { createNode } from '@/utilities/plugins/node-factory';
import pluginApi from '@/services/api/plugin/plugin';
import { useTeamStore } from '@/stores/slices/team';
import { runRequest } from '../../helpers';
import type { IPluginRecord } from '@/services/api/plugin/types';

type ValidationResult = {
    valid: boolean; 
    errors: string[] 
};

type PluginNodeData = {
    modifier?: unknown;
    arguments?: unknown;
    context?: unknown;
    forEach?: unknown;
    entrypoint?: unknown;
    exposure?: unknown;
    schema?: unknown;
    visualizers?: unknown;
    export?: unknown;
    ifStatement?: unknown;
    [key: string]: unknown;
};

type NodesUpdater = Node<PluginNodeData>[] | ((prev: Node<PluginNodeData>[]) => Node<PluginNodeData>[]);
type EdgesUpdater = Edge[] | ((prev: Edge[]) => Edge[]);

const DEFAULT_EDGE_STYLE = { animated: true, style: { stroke: '#64748b', strokeWidth: 2 } };

export interface PluginBuilderState {
    nodes: Node<PluginNodeData>[];
    edges: Edge[];
    selectedNode: Node<PluginNodeData> | null;
    currentPlugin: IPluginRecord | null;
    isSaving: boolean;
    isLoading: boolean;
    isValidating: boolean;
    saveError: string | null;
    loadError: string | null;
    validationResult: ValidationResult | null;

    setNodes: (nodesOrUpdater: NodesUpdater) => void;
    setEdges: (edgesOrUpdater: EdgesUpdater) => void;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    validateConnection: (connection: Connection) => boolean;
    onConnect: (connection: Connection) => void;
    onNodeClick: (_event: unknown, node: Node<PluginNodeData>) => void;
    onPaneClick: () => void;
    selectNode: (node: Node<PluginNodeData> | null) => void;
    addNode: (type: NodeType, position: XYPosition) => void;
    updateNodeData: (nodeId: string, data: Partial<PluginNodeData>) => void;
    deleteNode: (nodeId: string) => void;
    deleteEdge: (edgeId: string) => void;
    getWorkflow: () => IWorkflow;
    loadWorkflow: (workflow: IWorkflow) => void;
    clearWorkflow: () => void;
    saveWorkflow: () => Promise<IPluginRecord | null>;
    loadPluginById: (idOrSlug: string) => Promise<void>;
}

const initialState = {
    nodes: [] as Node<PluginNodeData>[],
    edges: [] as Edge[],
    selectedNode: null as Node<PluginNodeData> | null,
    currentPlugin: null as IPluginRecord | null,
    isSaving: false,
    isLoading: false,
    isValidating: false,
    saveError: null as string | null,
    loadError: null as string | null,
    validationResult: null as ValidationResult | null
};

export const usePluginBuilderStore = create<PluginBuilderState>((set, get) => ({
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

    onNodesChange: (changes) => set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
    onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

    validateConnection(connection) {
        const { nodes, edges } = get();
        const { source, target } = connection;
        if (!source || !target || source === target) return false;

        const srcNode = nodes.find(n => n.id === source);
        const tgtNode = nodes.find(n => n.id === target);
        if (!srcNode?.type || !tgtNode?.type) return false;

        const srcConfig = NODE_CONFIGS[srcNode.type as NodeType];
        const tgtConfig = NODE_CONFIGS[tgtNode.type as NodeType];
        if (!srcConfig || !tgtConfig) return false;
        if (!srcConfig.allowedConnections.to.includes(tgtNode.type as NodeType)) return false;
        if (edges.some(e => e.source === source && e.target === target)) return false;

        const tgtLimit = typeof tgtConfig.inputs === 'number' ? tgtConfig.inputs : 1;
        if (tgtLimit !== -1 && edges.filter(e => e.target === target).length >= tgtLimit) return false;

        const srcLimit = srcConfig.outputs;
        if (srcLimit !== -1 && edges.filter(e => e.source === source).length >= srcLimit) return false;

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

    addNode: (type, position) => set((s) => ({ nodes: [...s.nodes, createNode(type, position)] })),

    updateNodeData(nodeId, data) {
        set((s) => {
            const nodes = s.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n);
            const selectedNode = s.selectedNode?.id === nodeId
                ? { ...s.selectedNode, data: { ...s.selectedNode.data, ...data } }
                : s.selectedNode;
            return { nodes, selectedNode };
        });
    },

    deleteNode: (nodeId) => set((s) => ({
        nodes: s.nodes.filter(n => n.id !== nodeId),
        edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        selectedNode: s.selectedNode?.id === nodeId ? null : s.selectedNode
    })),

    deleteEdge: (edgeId) => set((s) => ({ edges: s.edges.filter(e => e.id !== edgeId) })),

    getWorkflow() {
        const { nodes, edges } = get();
        return {
            nodes: nodes.map(n => ({
                id: n.id,
                type: n.type as NodeType,
                position: n.position,
                data: {
                    modifier: n.data?.modifier,
                    arguments: n.data?.arguments,
                    context: n.data?.context,
                    forEach: n.data?.forEach,
                    entrypoint: n.data?.entrypoint,
                    exposure: n.data?.exposure,
                    schema: n.data?.schema,
                    visualizers: n.data?.visualizers,
                    export: n.data?.export,
                    ifStatement: n.data?.ifStatement
                }
            })) as IWorkflow['nodes'],
            edges: edges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle ?? undefined,
                targetHandle: e.targetHandle ?? undefined
            })) as IWorkflow['edges'],
            viewport: { x: 0, y: 0, zoom: 1 }
        };
    },

    loadWorkflow(workflow) {
        set({
            nodes: workflow.nodes.map(n => ({
                id: n.id,
                type: n.type,
                position: n.position,
                data: { ...n.data }
            })) as Node<PluginNodeData>[],
            edges: workflow.edges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle ?? undefined,
                targetHandle: e.targetHandle ?? undefined,
                ...DEFAULT_EDGE_STYLE
            })),
            selectedNode: null,
            validationResult: null,
            saveError: null,
            loadError: null
        });
    },

    clearWorkflow: () => set(initialState),

    async saveWorkflow() {
        const { getWorkflow, currentPlugin } = get();
        return await runRequest(set, get,
            () => pluginApi.saveWorkflow(getWorkflow(), currentPlugin?._id, useTeamStore.getState().selectedTeam?._id),
            {
                loadingKey: 'isSaving',
                errorKey: 'saveError',
                errorFallback: 'Failed to save workflow',
                onSuccess: (saved) => set({ currentPlugin: saved })
            }
        );
    },

    async loadPluginById(idOrSlug) {
        await runRequest(set, get, () => pluginApi.getPlugin(idOrSlug), {
            loadingKey: 'isLoading',
            errorKey: 'loadError',
            errorFallback: 'Failed to load plugin',
            onSuccess: (plugin) => {
                get().loadWorkflow(plugin.workflow);
                set({ currentPlugin: plugin });
            }
        });
    },
}));

