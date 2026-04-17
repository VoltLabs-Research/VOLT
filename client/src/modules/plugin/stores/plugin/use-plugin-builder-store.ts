import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Node, Edge, Connection, NodeChange, EdgeChange, XYPosition } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { IWorkflow, INodeData } from '@/modules/plugin/api/entities/plugin/workflow';
import { NodeType, PluginNodeExecutionMode } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { NODE_CONFIGS, createNode } from '@/modules/plugin/utilities/plugin/node-registry';

type ValidationResult = {
    valid: boolean;
    errors: string[];
};

type NodesUpdater = Node<INodeData>[] | ((prev: Node<INodeData>[]) => Node<INodeData>[]);
type EdgesUpdater = Edge[] | ((prev: Edge[]) => Edge[]);
type BuilderHistoryState = {
    nodes: Node<INodeData>[];
    edges: Edge[];
    graphVersion: number;
};

const DEFAULT_EDGE_STYLE = { animated: true, style: { stroke: '#64748b', strokeWidth: 2 } };

const serializeHistoryState = (state: Pick<PluginBuilderState, 'nodes' | 'edges' | 'graphVersion'>): BuilderHistoryState => {
    return {
        nodes: state.nodes.map((node) => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: node.data
        })) as Node<INodeData>[],
        edges: state.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle ?? undefined,
            targetHandle: edge.targetHandle ?? undefined,
            ...DEFAULT_EDGE_STYLE
        })),
        graphVersion: state.graphVersion
    };
};

interface PluginBuilderState {
    nodes: Node<INodeData>[];
    edges: Edge[];
    selectedNode: Node<INodeData> | null;
    isSaving: boolean;
    saveError: string | null;
    validationResult: ValidationResult | null;
    graphVersion: number;
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
    setSaving: (value: boolean) => void;
    setSaveError: (error: string | null) => void;
    setValidationResult: (result: ValidationResult | null) => void;
    undo: () => void;
    redo: () => void;
    reset: () => void;
};

type PluginBuilderStore = PluginBuilderState & PluginBuilderActions;

const initialState: PluginBuilderState = {
    nodes: [],
    edges: [],
    selectedNode: null,
    isSaving: false,
    saveError: null,
    validationResult: null,
    graphVersion: 0
};

const areHistoryStatesEqual = (pastState: BuilderHistoryState, currentState: BuilderHistoryState) => {
    return pastState.graphVersion === currentState.graphVersion;
};

const bumpGraphVersion = (currentVersion: number): number => currentVersion + 1;

const hasNodeDataChanges = (currentData: INodeData, nextData: Partial<INodeData>): boolean => {
    const nextEntries = Object.entries(nextData);

    if (nextEntries.length === 0) {
        return false;
    }

    return nextEntries.some(([key, value]) => !Object.is(currentData[key], value));
};

export const usePluginBuilderStore = create<PluginBuilderStore>()(
    temporal<PluginBuilderStore, [], [], BuilderHistoryState>(
        (set, get) => {
            const _validate = () => {
                const { nodes, edges } = get();
                const errors: string[] = [];
                const nodeTypes = nodes.map((n) => n.type);

                if (!nodeTypes.includes('modifier')) {
                    errors.push('Missing Modifier node — required as the plugin entry point.');
                }
                if (nodeTypes.includes('modifier') && !edges.some((e) => {
                    const src = nodes.find((n) => n.id === e.source);
                    return src?.type === 'modifier';
                })) {
                    if (nodes.length > 1) errors.push('Modifier node has no outgoing connections.');
                }

                set({ validationResult: { valid: errors.length === 0, errors } });
            };

            const _runWithoutHistory = (callback: () => void) => {
                const temporalState = usePluginBuilderStore.temporal.getState();
                temporalState.pause();
                temporalState.clear();

                try {
                    callback();
                } finally {
                    temporalState.resume();
                }
            };

            const _setGraphState = (updater: (state: PluginBuilderState) => Partial<PluginBuilderState> | null) => {
                const currentState = get();
                const nextState = updater(currentState);

                if (!nextState) {
                    return;
                }

                set({
                    ...nextState,
                    graphVersion: bumpGraphVersion(currentState.graphVersion)
                });

                _validate();
            };

            return {
            ...initialState,

            setNodes: (nodesOrUpdater) => {
                _setGraphState((state) => {
                    const nextNodes = typeof nodesOrUpdater === 'function'
                        ? nodesOrUpdater(state.nodes)
                        : nodesOrUpdater;

                    if (nextNodes === state.nodes) {
                        return null;
                    }

                    return { nodes: nextNodes };
                });
            },

            setEdges: (edgesOrUpdater) => {
                _setGraphState((state) => {
                    const nextEdges = typeof edgesOrUpdater === 'function'
                        ? edgesOrUpdater(state.edges)
                        : edgesOrUpdater;

                    if (nextEdges === state.edges) {
                        return null;
                    }

                    return { edges: nextEdges };
                });
            },

            onNodesChange: (changes) => {
                _setGraphState((state) => ({
                    nodes: applyNodeChanges(changes, state.nodes) as Node<INodeData>[]
                }));
            },

            onEdgesChange: (changes) => {
                _setGraphState((state) => ({
                    edges: applyEdgeChanges(changes, state.edges)
                }));
            },

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
                if (!tgtConfig.allowedConnections.from.includes(srcNode.type as NodeType)) return false;
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

                _setGraphState((state) => ({ edges: addEdge(edge, state.edges) }));
            },

            onNodeClick: (_, node) => set({ selectedNode: node }),

            onPaneClick: () => set({ selectedNode: null }),

            selectNode: (node) => set({ selectedNode: node }),

            addNode: (type, position) => {
                _setGraphState((state) => ({ nodes: [...state.nodes, createNode(type, position)] }));
            },

            updateNodeData(nodeId, data) {
                _setGraphState((state) => {
                    const targetNode = state.nodes.find((node) => node.id === nodeId);

                    if (!targetNode || !hasNodeDataChanges(targetNode.data, data)) {
                        return null;
                    }

                    const mergedNodeData = { ...targetNode.data, ...data };
                    const nodes = state.nodes.map((node) =>
                        node.id === nodeId ? { ...node, data: mergedNodeData } : node
                    );
                    const selectedNode = state.selectedNode?.id === nodeId
                        ? { ...state.selectedNode, data: mergedNodeData }
                        : state.selectedNode;

                    return { nodes, selectedNode };
                });
            },

            deleteNode: (nodeId) => {
                _setGraphState((state) => {
                    const hasNode = state.nodes.some((node) => node.id === nodeId);

                    if (!hasNode) {
                        return null;
                    }

                    return {
                        nodes: state.nodes.filter((node) => node.id !== nodeId),
                        edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
                        selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode
                    };
                });
            },

            deleteEdge: (edgeId) => {
                _setGraphState((state) => {
                    const hasEdge = state.edges.some((edge) => edge.id === edgeId);

                    if (!hasEdge) {
                        return null;
                    }

                    return { edges: state.edges.filter((edge) => edge.id !== edgeId) };
                });
            },

            getWorkflow() {
                const { nodes, edges } = get();

                return {
                    nodes: nodes.map((n) => {
                        const pluginNode = n.type === NodeType.PLUGIN ? n.data.pluginNode : undefined;
                        const pluginId = pluginNode?.pluginId?.trim() ?? '';
                        const argumentReference = pluginNode?.argumentReference?.trim() ?? '';
                        const executionMode = pluginNode?.executionMode === PluginNodeExecutionMode.ARGUMENT_REFERENCE
                            ? PluginNodeExecutionMode.ARGUMENT_REFERENCE
                            : pluginNode?.executionMode === PluginNodeExecutionMode.MANUAL
                                ? PluginNodeExecutionMode.MANUAL
                                : !pluginId && argumentReference
                                    ? PluginNodeExecutionMode.ARGUMENT_REFERENCE
                                    : PluginNodeExecutionMode.MANUAL;

                        return {
                            id: n.id,
                            type: n.type as NodeType,
                            position: {
                                x: n.position.x,
                                y: n.position.y
                            },
                            data: pluginNode
                                ? {
                                    ...n.data,
                                    pluginNode: {
                                        ...pluginNode,
                                        pluginId,
                                        argumentReference,
                                        executionMode
                                    }
                                }
                                : n.data
                        };
                    }),
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
                _runWithoutHistory(() => {
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
                        selectedNode: null
                    });
                });
                _validate();
            },

            clearWorkflow: () => {
                _runWithoutHistory(() => {
                    set(initialState);
                });
                _validate();
            },

            setSaving: (value) => set({ isSaving: value }),

            setSaveError: (error) => set({ saveError: error }),

            setValidationResult: (result) => set({ validationResult: result }),

            undo: () => {
                usePluginBuilderStore.temporal.getState().undo();
                set({ selectedNode: null });
                _validate();
            },

            redo: () => {
                usePluginBuilderStore.temporal.getState().redo();
                set({ selectedNode: null });
                _validate();
            },

            reset: () => {
                _runWithoutHistory(() => {
                    set(initialState);
                });
                _validate();
            }
            };
        },
        {
            partialize: serializeHistoryState,
            equality: areHistoryStatesEqual,
            limit: 50
        }
    )
);

export default usePluginBuilderStore;
