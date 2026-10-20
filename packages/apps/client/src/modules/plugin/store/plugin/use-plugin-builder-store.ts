import { create } from 'zustand';
import { temporal } from 'zundo';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { collectWorkflowErrors, isConnectionAllowed } from '@/modules/plugin/store/plugin/builder-graph-rules';
import { createNode } from '@/modules/plugin/utils/plugin/node-registry';
import {
    DEFAULT_EDGE_STYLE,
    toBuilderEdges,
    toBuilderNodes,
    toWorkflowEdges,
    toWorkflowNodes
} from '@/modules/plugin/store/plugin/builder-graph-mapping';
import type { Node, Edge, Connection, NodeChange, EdgeChange, XYPosition } from '@xyflow/react';
import type { IWorkflow, INodeData } from '@volt/contracts/modules/plugin/workflow';
import type { NodeType } from '@volt/contracts/modules/plugin/enums';

interface PluginBuilderState {
    nodes: Node<INodeData>[];
    edges: Edge[];
    selectedNode: Node<INodeData> | null;
    isSaving: boolean;
    validationErrors: string[];

    graphVersion: number;
}

interface PluginBuilderActions {
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
    getWorkflow: () => IWorkflow;
    loadWorkflow: (workflow: IWorkflow) => void;
    clearWorkflow: () => void;
    setSaving: (value: boolean) => void;
    undo: () => void;
    redo: () => void;
    reset: () => void;
}

type PluginBuilderStore = PluginBuilderState & PluginBuilderActions;

type BuilderHistoryState = Pick<PluginBuilderState, 'nodes' | 'edges' | 'graphVersion'>;

const initialState: PluginBuilderState = {
    nodes: [],
    edges: [],
    selectedNode: null,
    isSaving: false,
    validationErrors: [],
    graphVersion: 0
};

const serializeHistoryState = (state: PluginBuilderState): BuilderHistoryState => ({
    nodes: toBuilderNodes(state.nodes),
    edges: toBuilderEdges(state.edges),
    graphVersion: state.graphVersion
});

const hasNodeDataChanges = (currentData: INodeData, nextData: Partial<INodeData>): boolean => {
    return Object.entries(nextData).some(([key, value]) => !Object.is(currentData[key], value));
};

export const usePluginBuilderStore = create<PluginBuilderStore>()(
    temporal<PluginBuilderStore, [], [], BuilderHistoryState>(
        (set, get) => {
            const _revalidate = () => {
                const { nodes, edges } = get();
                set({ validationErrors: collectWorkflowErrors(nodes, edges) });
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
                    graphVersion: currentState.graphVersion + 1
                });

                _revalidate();
            };

            const _resetGraph = () => {
                _runWithoutHistory(() => {
                    set(initialState);
                });
                _revalidate();
            };

            return {
            ...initialState,

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
                return isConnectionAllowed(nodes, edges, connection);
            },

            onConnect(connection) {
                if (!get().validateConnection(connection)) return;

                const edge: Edge = {
                    id: `e-${connection.source}-${connection.target}-${connection.sourceHandle ?? 's'}-${connection.targetHandle ?? 't'}`,
                    source: connection.source,
                    target: connection.target,
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

                    const mergedNodeData = {
                        ...targetNode.data,
                        ...data
                    };

                    return {
                        nodes: state.nodes.map((node) =>
                            node.id === nodeId ? {
                                ...node,
                                data: mergedNodeData
                            } : node
                        ),
                        selectedNode: state.selectedNode?.id === nodeId
                            ? {
                                ...state.selectedNode,
                                data: mergedNodeData
                            }
                            : state.selectedNode
                    };
                });
            },

            deleteNode: (nodeId) => {
                _setGraphState((state) => {
                    if (!state.nodes.some((node) => node.id === nodeId)) {
                        return null;
                    }

                    return {
                        nodes: state.nodes.filter((node) => node.id !== nodeId),
                        edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
                        selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode
                    };
                });
            },

            getWorkflow() {
                const { nodes, edges } = get();

                return {
                    nodes: toWorkflowNodes(nodes),
                    edges: toWorkflowEdges(edges),
                    viewport: {
                        x: 0,
                        y: 0,
                        zoom: 1
                    }
                };
            },

            loadWorkflow(workflow) {
                _runWithoutHistory(() => {
                    set({
                        nodes: toBuilderNodes(workflow.nodes),
                        edges: toBuilderEdges(workflow.edges),
                        selectedNode: null
                    });
                });
                _revalidate();
            },

            clearWorkflow: _resetGraph,

            reset: _resetGraph,

            setSaving: (value) => set({ isSaving: value }),

            undo: () => {
                usePluginBuilderStore.temporal.getState().undo();
                set({ selectedNode: null });
                _revalidate();
            },

            redo: () => {
                usePluginBuilderStore.temporal.getState().redo();
                set({ selectedNode: null });
                _revalidate();
            }
            };
        },
        {
            partialize: serializeHistoryState,
            equality: (pastState, currentState) => pastState.graphVersion === currentState.graphVersion,
            limit: 50
        }
    )
);
