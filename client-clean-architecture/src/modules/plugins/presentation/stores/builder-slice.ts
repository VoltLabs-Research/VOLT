import { create } from 'zustand';
import type { Node, Edge, Connection, NodeChange, EdgeChange, XYPosition } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { useTeamStore } from '@/modules/team/presentation/stores';
import { runRequest } from '@/shared/presentation/stores/helpers';
import { NODE_CONFIGS } from '../utilities/node-types';
import { createNode } from '../utilities/node-factory';
import type { NodeType, IWorkflow, Plugin } from '../../domain/entities';
import { ConnectionValidationService } from '../../domain/services/ConnectionValidationService';
import { WorkflowSerializationService } from '../../domain/services/WorkflowSerializationService';
import { pluginRepository } from '@/modules/plugins/infrastructure/repositories/PluginRepository';

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

const connectionValidator = new ConnectionValidationService();
const workflowSerializer = new WorkflowSerializationService();

export interface PluginBuilderState {
    nodes: Node<PluginNodeData>[];
    edges: Edge[];
    selectedNode: Node<PluginNodeData> | null;
    currentPlugin: Plugin | null;
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
    saveWorkflow: () => Promise<Plugin | null>;
    loadPluginById: (idOrSlug: string) => Promise<void>;
}

const initialState = {
    nodes: [] as Node<PluginNodeData>[],
    edges: [] as Edge[],
    selectedNode: null as Node<PluginNodeData> | null,
    currentPlugin: null as Plugin | null,
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
        const result = connectionValidator.validateConnection(
            { source: connection.source ?? null, target: connection.target ?? null },
            nodes.map((node) => ({ id: node.id, type: node.type ?? '' })),
            edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
            NODE_CONFIGS
        );
        return result.valid;
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
        return workflowSerializer.toWorkflow(
            nodes.map((node) => ({
                id: node.id,
                type: node.type ?? '',
                position: node.position,
                data: node.data ?? undefined
            })),
            edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle ?? undefined,
                targetHandle: edge.targetHandle ?? undefined
            }))
        ) as IWorkflow;
    },

    loadWorkflow(workflow) {
        const { nodes, edges } = workflowSerializer.fromWorkflow(workflow);
        set({
            nodes: nodes.map((node) => ({
                id: node.id,
                type: node.type as NodeType,
                position: node.position,
                data: { ...(node.data ?? {}) }
            })) as Node<PluginNodeData>[],
            edges: edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle ?? undefined,
                targetHandle: edge.targetHandle ?? undefined,
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
        const workflow = getWorkflow();
        const teamId = useTeamStore.getState().selectedTeam?._id;

        if (currentPlugin?._id) {
            return await runRequest(set, get,
                () => pluginRepository.updatePlugin(currentPlugin._id, { workflow }),
                {
                    loadingKey: 'isSaving',
                    errorKey: 'saveError',
                    errorFallback: 'Failed to save workflow',
                    onSuccess: (saved) => set({ currentPlugin: saved })
                }
            );
        } else {
            return await runRequest(set, get,
                () => pluginRepository.createPlugin({ workflow, team: teamId }),
                {
                    loadingKey: 'isSaving',
                    errorKey: 'saveError',
                    errorFallback: 'Failed to create workflow',
                    onSuccess: (saved) => set({ currentPlugin: saved })
                }
            );
        }
    },

    async loadPluginById(idOrSlug) {
        await runRequest(set, get, () => pluginRepository.getPlugin(idOrSlug), {
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
