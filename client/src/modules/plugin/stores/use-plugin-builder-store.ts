import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Node, Edge, Connection, NodeChange, EdgeChange, XYPosition } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { IWorkflow, INodeData } from '../api/entities/workflow';
import { NodeType } from '../api/entities/workflow-enums';
import { NODE_CONFIGS } from '../utilities/node-types';
import { createNode } from '../utilities/node-factory';

type ValidationResult = {
    valid: boolean;
    errors: string[];
};

type NodesUpdater = Node<INodeData>[] | ((prev: Node<INodeData>[]) => Node<INodeData>[]);
type EdgesUpdater = Edge[] | ((prev: Edge[]) => Edge[]);
type BuilderHistoryState = {
    nodes: Node<INodeData>[];
    edges: Edge[];
};

const DEFAULT_EDGE_STYLE = { animated: true, style: { stroke: '#64748b', strokeWidth: 2 } };

const serializeHistoryState = (state: Pick<PluginBuilderState, 'nodes' | 'edges'>): BuilderHistoryState => {
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
        }))
    };
};

interface PluginBuilderState {
    nodes: Node<INodeData>[];
    edges: Edge[];
    selectedNode: Node<INodeData> | null;
    isSaving: boolean;
    saveError: string | null;
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
    validationResult: null
};

const areHistoryStatesEqual = (pastState: BuilderHistoryState, currentState: BuilderHistoryState) => {
    if (pastState.nodes.length !== currentState.nodes.length || pastState.edges.length !== currentState.edges.length) {
        return false;
    }

    for (let index = 0; index < pastState.nodes.length; index += 1) {
        const pastNode = pastState.nodes[index];
        const currentNode = currentState.nodes[index];

        if (
            pastNode.id !== currentNode.id ||
            pastNode.type !== currentNode.type ||
            pastNode.position.x !== currentNode.position.x ||
            pastNode.position.y !== currentNode.position.y ||
            JSON.stringify(pastNode.data) !== JSON.stringify(currentNode.data)
        ) {
            return false;
        }
    }

    for (let index = 0; index < pastState.edges.length; index += 1) {
        const pastEdge = pastState.edges[index];
        const currentEdge = currentState.edges[index];

        if (
            pastEdge.id !== currentEdge.id ||
            pastEdge.source !== currentEdge.source ||
            pastEdge.target !== currentEdge.target ||
            pastEdge.sourceHandle !== currentEdge.sourceHandle ||
            pastEdge.targetHandle !== currentEdge.targetHandle
        ) {
            return false;
        }
    }

    return true;
};

const usePluginBuilderStore = create<PluginBuilderStore>()(
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

            return {
            ...initialState,

            setNodes: (nodesOrUpdater) => {
                set(typeof nodesOrUpdater === 'function'
                    ? (s) => ({ nodes: nodesOrUpdater(s.nodes) })
                    : { nodes: nodesOrUpdater });
                _validate();
            },

            setEdges: (edgesOrUpdater) => {
                set(typeof edgesOrUpdater === 'function'
                    ? (s) => ({ edges: edgesOrUpdater(s.edges) })
                    : { edges: edgesOrUpdater });
                _validate();
            },

            onNodesChange: (changes) => {
                set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as Node<INodeData>[] }));
                _validate();
            },

            onEdgesChange: (changes) => {
                set((s) => ({
                    edges: applyEdgeChanges(changes, s.edges)
                }));
                _validate();
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
                _validate();
            },

            onNodeClick: (_, node) => set({ selectedNode: node }),

            onPaneClick: () => set({ selectedNode: null }),

            selectNode: (node) => set({ selectedNode: node }),

            addNode: (type, position) => {
                set((s) => ({ nodes: [...s.nodes, createNode(type, position)] }));
                _validate();
            },

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

            deleteNode: (nodeId) => {
                set((s) => ({
                    nodes: s.nodes.filter((n) => n.id !== nodeId),
                    edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
                    selectedNode: s.selectedNode?.id === nodeId ? null : s.selectedNode
                }));
                _validate();
            },

            deleteEdge: (edgeId) => {
                set((s) => ({ edges: s.edges.filter((e) => e.id !== edgeId) }));
                _validate();
            },

            getWorkflow() {
                const { nodes, edges } = get();

                return {
                    nodes: nodes.map((n) => ({
                        id: n.id,
                        type: n.type as NodeType,
                        position: {
                            x: n.position.x,
                            y: n.position.y
                        },
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

export { usePluginBuilderStore };
export default usePluginBuilderStore;
