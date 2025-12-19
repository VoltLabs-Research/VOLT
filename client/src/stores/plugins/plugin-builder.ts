import { create } from 'zustand';
import type { Node, Edge, Connection, NodeChange, EdgeChange, XYPosition } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { NodeType, type IWorkflow } from '@/types/plugin';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';
import { createNode } from '@/utilities/plugins/node-factory';
import pluginApi, { type IPluginRecord } from '@/services/api/plugin';
import useTeamStore from '@/stores/team/team';

type ValidationResult = {
    valid: boolean;
    errors: string[];
};

// TODO:
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
    [key: string]: unknown;
};

type NodesUpdater = Node<PluginNodeData>[] | ((prev: Node<PluginNodeData>[]) => Node<PluginNodeData>[]);
type EdgesUpdater = Edge[] | ((prev: Edge[]) => Edge[]);

const DEFAULT_EDGE_STYLE = {
    animated: true,
    style: { stroke: '#64748b', strokeWidth: 2 }
};

// TODO: duplicated code
const getErrorMessage = (err: unknown, fallback: string) => {
    const anyErr = err as any;
    return anyErr?.response?.data?.message || anyErr?.message || fallback;
};

export interface PluginBuilderState {
    // Graph
    nodes: Node<PluginNodeData>[];
    edges: Edge[];
    selectedNode: Node<PluginNodeData> | null;

    // Plugin record from backend
    currentPlugin: IPluginRecord | null;

    // Operation states
    isSaving: boolean;
    isLoading: boolean;
    isValidating: boolean;
    saveError: string | null;
    loadError: string | null;
    validationResult: ValidationResult | null;

    // Actions
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
    setCurrentPlugin: (plugin: IPluginRecord | null) => void;

    saveWorkflow: () => Promise<IPluginRecord | null>;
    loadPluginById: (idOrSlug: string) => Promise<void>;
    validateCurrentWorkflow: () => Promise<ValidationResult>;
    publishPlugin: () => Promise<IPluginRecord | null>;
};

const usePluginBuilderStore = create<PluginBuilderState>((set, get) => ({
    nodes: [],
    edges: [],
    selectedNode: null,

    currentPlugin: null,

    isSaving: false,
    isLoading: false,
    isValidating: false,
    saveError: null,
    loadError: null,
    validationResult: null,

    setNodes(nodesOrUpdater: NodesUpdater) {
        if(typeof nodesOrUpdater === 'function'){
            set((state) => ({ nodes: nodesOrUpdater(state.nodes) }));
            return;
        }

        set({ nodes: nodesOrUpdater });
    },

    setEdges(edgesOrUpdater: EdgesUpdater) {
        if(typeof edgesOrUpdater === 'function'){
            set((state) => ({ edges: edgesOrUpdater(state.edges) }));
            return;
        }

        set({ edges: edgesOrUpdater });
    },

    onNodesChange(changes: NodeChange[]) {
        set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }));
    },

    onEdgesChange(changes: EdgeChange[]) {
        set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }));
    },

    validateConnection(connection: Connection) {
        const { nodes, edges } = get();
        const { source, target } = connection;
        if((!source || !target) || (source === target)) return false;

        const sourceNode = nodes.find((node: Node) => node.id === source);
        const targetNode = nodes.find((node: Node) => node.id === target);
        if(!sourceNode || !targetNode) return false;

        if(!sourceNode?.type || !targetNode?.type) return false;

        const sourceConfig = NODE_CONFIGS[sourceNode.type as NodeType];
        const targetConfig = NODE_CONFIGS[targetNode.type as NodeType];
        if(!sourceConfig || !targetConfig) return false;

        const canConnectByType = sourceConfig.allowedConnections.to.includes(targetNode.type as NodeType);
        if(!canConnectByType) return false;

        const alreadyConnected = edges.some((edge: Edge) => edge.source === source && edge.target === target);
        if(alreadyConnected) return false;

        const targetInputLimit = typeof targetConfig.inputs === 'number' ? targetConfig.inputs : 1;
        if(targetInputLimit !== -1){
            const targetInputCount = edges.filter((edge: Edge) => edge.target === target).length;
            if(targetInputCount >= targetInputLimit) return false;
        }

        const sourceOutputLimit = sourceConfig.outputs;
        if(sourceOutputLimit !== -1){
            const sourceOutputCount = edges.filter((edge: Edge) => edge.source === source).length;
            if(sourceOutputCount >= sourceOutputLimit) return false;
        }
        return true;
    },

    onConnect(connection: Connection) {
        const { validateConnection } = get();
        if(!validateConnection(connection)) return;
        const edge: Edge = {
            id: `e-${connection.source}-${connection.target}-${connection.sourceHandle ?? 's'}-${connection.targetHandle ?? 't'}`,
            source: connection.source!,
            target: connection.target!,
            sourceHandle: connection.sourceHandle ?? undefined,
            targetHandle: connection.targetHandle ?? undefined,
                ...DEFAULT_EDGE_STYLE,
        };
        set((state) => ({ edges: addEdge(edge, state.edges) }));
    },

    onNodeClick(event: unknown, node: Node<PluginNodeData>) {
        set({ selectedNode: node });
    },

    onPaneClick() {
        set({ selectedNode: null });
    },

    selectNode(node) {
        set({ selectedNode: node });
    },

    addNode(type: NodeType, position: XYPosition) {
        const newNode = createNode(type, position);
        set((state) => ({ nodes: [...state.nodes, newNode] }));
    },

    updateNodeData(nodeId: string, data: Partial<PluginNodeData>) {
        set((state) => {
            const nodes = state.nodes.map((node) =>
                node.id === nodeId ? { ...node, data: { ...(node.data ?? {}), ...data } } : node);

            const selectedNode =
                state.selectedNode?.id === nodeId
                    ? { ...state.selectedNode, data: { ...(state.selectedNode.data ?? {}), ...data } }
                    : state.selectedNode;
            return { nodes, selectedNode };
        });
    },

    deleteNode(nodeId: string) {
        set((state) => ({
            nodes: state.nodes.filter((n) => n.id !== nodeId),
            edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
            selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode,
        }));
    },

    deleteEdge(edgeId: string) {
        set((state) => ({ edges: state.edges.filter((edge: Edge) => edge.id !== edgeId) }));
    },

    getWorkflow() {
        const { nodes, edges } = get();

        return {
            nodes: nodes.map((node: Node) => ({
                id: node.id,
                type: node.type as NodeType,
                position: node.position,
                data: {
                    modifier: node.data?.modifier,
                    arguments: node.data?.arguments,
                    context: node.data?.context,
                    forEach: node.data?.forEach,
                    entrypoint: node.data?.entrypoint,
                    exposure: node.data?.exposure,
                    schema: node.data?.schema,
                    visualizers: node.data?.visualizers,
                    export: node.data?.export,
                },
            })) as IWorkflow['nodes'],

            edges: edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle ?? undefined,
                targetHandle: edge.targetHandle ?? undefined,
            })) as IWorkflow['edges'],

            viewport: { x: 0, y: 0, zoom: 1 },
        };
    },

    loadWorkflow(workflow: IWorkflow) {
        set({
            nodes: workflow.nodes.map((node) => ({
                id: node.id,
                type: node.type,
                position: node.position,
                data: { ...(node.data ?? {}) },
            })) as Node<PluginNodeData>[],

            edges: workflow.edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle ?? undefined,
                targetHandle: edge.targetHandle ?? undefined,
                    ...DEFAULT_EDGE_STYLE,
            })),

            selectedNode: null,
            validationResult: null,
            saveError: null,
            loadError: null,
        });
    },

    clearWorkflow() {
        set({
            nodes: [],
            edges: [],
            selectedNode: null,
            currentPlugin: null,
            validationResult: null,
            saveError: null,
            loadError: null,
            isSaving: false,
            isLoading: false,
            isValidating: false,
        });
    },

    setCurrentPlugin(plugin) {
        set({ currentPlugin: plugin });
    },

    async saveWorkflow() {
        const { getWorkflow, currentPlugin } = get();
        set({ isSaving: true, saveError: null });

        try{
            const workflow = getWorkflow();
            const teamId = useTeamStore.getState().selectedTeam?._id;
            const saved = await pluginApi.saveWorkflow(workflow, currentPlugin?._id, teamId);
            set({
                currentPlugin: saved,
                isSaving: false,
                saveError: null
            });
            return saved;
        }catch(err){
            const msg = getErrorMessage(err, 'Failed to save workflow');
            set({ isSaving: false, saveError: msg });
            return null;
        }
    },

    async loadPluginById(idOrSlug: string) {
        set({ isLoading: true, loadError: null });

        try{
            const plugin = await pluginApi.getPlugin(idOrSlug);
            get().loadWorkflow(plugin.workflow);
            set({
                currentPlugin: plugin,
                isLoading: false,
                loadError: null
            });
        }catch(err){
            const msg = getErrorMessage(err, 'Failed to load plugin');
            set({ isLoading: false, loadError: msg });
        }
    },

    async validateCurrentWorkflow(): Promise<any>{
        const { getWorkflow } = get();
        set({ isValidating: true });

        try{
            const workflow = getWorkflow();
            const result = await pluginApi.validateWorkflow(workflow);
            set({
                validationResult: result,
                isValidating: false
            });
            return result;
        }catch(err){
            const result: ValidationResult = {
                valid: false,
                errors: [getErrorMessage(err, 'Validation failed')],
            };
            set({ validationResult: result, isValidating: false });
            return result;
        }
    },

    async publishPlugin() {
        const { currentPlugin, validateCurrentWorkflow } = get();
        if(!currentPlugin?._id){
            set({ saveError: 'Plugin must be saved before publishing' });
            return null;
        }

        const validation = await validateCurrentWorkflow();
        if(!validation.valid){
            set({ saveError: `Cannot publish: ${validation.errors.join(', ')}` });
            return null;
        }

        set({ isSaving: true, saveError: null });

        try{
            const published = await pluginApi.publishPlugin(currentPlugin._id);
            set({
                currentPlugin: published,
                isSaving: false,
                saveError: null
            });
            return published;
        }catch(err){
            const msg = getErrorMessage(err, 'Failed to publish plugin');
            set({ isSaving: false, saveError: msg });
            return null;
        }
    }
}));

export default usePluginBuilderStore;
