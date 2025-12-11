import { useCallback, useState } from 'react';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@xyflow/react';
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import { NodeType, type IWorkflow } from '@/types/plugin';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';
import { createNode } from '@/utilities/plugins/node-factory';

export interface UseWorkflowReturn{
    nodes: Node[];
    edges: Edge[];
    selectedNode: Node | null;
    onNodesChange(changes: NodeChange[]): void;
    onEdgesChange(changes: EdgeChange[]): void;
    onConnect(connection: Connection): void;
    onNodeClick(event: React.MouseEvent, node: Node): void;
    onPaneClick(): void;
    addNode(type: NodeType, position: { x: number; y: number }): void;
    updateNodeData(nodeId: string, data: any): void;
    deleteNode(nodeId: string): void;
    deleteEdge(nodeId: string): void;
    validateConnection(connection: Connection): boolean;
    getWorkflow(): IWorkflow;
    loadWorkflow(workflow: IWorkflow): void;
    clearWorkflow(): void;
};

const useWorkflow = (initialWorkflow?: IWorkflow): UseWorkflowReturn => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow?.nodes?.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data:  { name: node.name, ...node.data }
    })) || []);

    const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow?.edges?.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle
    })) || []);

    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    const validateConnection = useCallback((connection: Connection): boolean => {
        if(!connection.source || !connection.target) return false;

        const sourceNode = nodes.find((node) => node.id === connection.source);
        const targetNode = nodes.find((node) => node.id === connection.target);
        if(!sourceNode || !targetNode) return false;

        const sourceConfig = NODE_CONFIGS[sourceNode.type as NodeType];
        const targetConfig = NODE_CONFIGS[targetNode.type as NodeType];
        const canConnect = sourceConfig.allowedConnections.to.includes(targetNode.type as NodeType);
        const alreadyConnected = edges.some((edge) => edge.source === connection.source && edge.target === connection.target);
        const targetHasInput = edges.some((edge) => edge.target === connection.target);

        return canConnect && !alreadyConnected && !targetHasInput;
    }, [nodes, edges]);

    const onConnect = useCallback((connection: Connection) => {
        if(!validateConnection(connection)) return;
        const newEdge: Edge = {
            id: `e-${connection.source}-${connection.target}`,
            source: connection. source! ,
            target:  connection.target!,
            sourceHandle:  connection.sourceHandle || undefined,
            targetHandle: connection.targetHandle || undefined,
            animated: true,
            style: { stroke: '#64748b', strokeWidth: 2 }
        };
        setEdges((edges) => addEdge(newEdge, edges));
    }, [validateConnection, setEdges]);

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    const addNode = useCallback((type: NodeType, position: { x: number; y : number }) => {
        const newNode = createNode(type, position);
        setNodes((nodes) => [...nodes, newNode]);
    }, [setNodes]);

    const updateNodeData = useCallback((nodeId: string, data: any) => {
        setNodes((nodes) => nodes.map((node) => {
            if(node.id === nodeId){
                return { ...node, data: { ...node.data, ...data } };
            }
            return node;
        }));

        setSelectedNode((prev) => {
            if(prev?.id === nodeId){
                return { ...prev, data: { ...prev.data, ...data } };
            }
            return prev;
        });
    }, [setNodes]);

    const deleteNode = useCallback((nodeId: string) => {
        setNodes((nodes) => nodes.filter((node) => node.id !== nodeId));
        setEdges((edges) => edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
        if(selectedNode?.id === nodeId){
            setSelectedNode(null);
        }
    }, [setNodes, setEdges, selectedNode]);

    const deleteEdge = useCallback((edgeId: string) => {
        setEdges((edges) => edges.filter((edge) => edge.id !== edgeId));
    }, [setEdges]);

    const getWorkflow = useCallback((): IWorkflow => {
        return {
            nodes: nodes.map((node) => ({
                id: node.id,
                name: node.data.name || node.id,
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
            })),
            // @ts-ignore
            edges: edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle
            })),
            viewport: {
                x: 0,
                y: 0,
                zoom: 1
            }
        };
    }, [nodes, edges]);

    const loadWorkflow = useCallback((workflow: IWorkflow) => {
        setNodes(workflow.nodes.map((node) => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: { name: node.name, ...node.data }
        })));

        setEdges(workflow.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            animated: true,
            style: { stroke: '#64748b', strokeWidth: 2 }
        })));

        setSelectedNode(null);
    }, [setNodes, setEdges]);

    const clearWorkflow = useCallback(() => {
        setNodes([]);
        setEdges([]);
        setSelectedNode(null);
    }, [setNodes, setEdges]);

    return {
        nodes,
        edges,
        selectedNode,
        onNodesChange,
        onEdgesChange,
        onConnect,
        onNodeClick,
        onPaneClick,
        addNode,
        updateNodeData,
        deleteNode,
        deleteEdge,
        validateConnection,
        getWorkflow,
        loadWorkflow,
        clearWorkflow
    };
};

export default useWorkflow;