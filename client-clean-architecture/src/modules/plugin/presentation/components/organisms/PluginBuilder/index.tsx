import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Background, ReactFlow, type ReactFlowInstance, type Connection } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { nodeTypes } from '@/modules/plugin/presentation/components/molecules/nodes';
import { NodeType } from '@/modules/plugin/domain/entities';
import { NODE_CONFIGS } from '@/modules/plugin/presentation/utilities/node-types';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import { useSaveWorkflow } from '@/modules/plugin/presentation/hooks';
import PaletteItem from '@/modules/plugin/presentation/components/atoms/PaletteItem';
import NodeEditor from '@/modules/plugin/presentation/components/molecules/NodeEditor';
import EditableTag from '@/shared/presentation/components/EditableTag';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Title from '@/shared/presentation/components/Title';
import { TbArrowLeft } from 'react-icons/tb';
import '@xyflow/react/dist/style.css';
import './PluginBuilder.css';

const nodeTypesList = Object.values(NODE_CONFIGS);

interface PaletteContentProps {
    onDragStart: (e: DragEvent, type: NodeType) => void;
};

const PaletteContent = ({ onDragStart }: PaletteContentProps) => (
    <Container className='plugin-builder-palette'>
        {nodeTypesList.map((config) => (
            <PaletteItem config={config} onDragStart={onDragStart} key={config.type} />
        ))}
    </Container>
);

const PluginBuilder = () => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        onNodeClick,
        onPaneClick,
        addNode,
        validateConnection,
        selectedNode,
        selectNode,
        updateNodeData
    } = usePluginBuilderStore(
        useShallow((state) => ({
            nodes: state.nodes,
            edges: state.edges,
            onNodesChange: state.onNodesChange,
            onEdgesChange: state.onEdgesChange,
            onConnect: state.onConnect,
            onNodeClick: state.onNodeClick,
            onPaneClick: state.onPaneClick,
            addNode: state.addNode,
            validateConnection: state.validateConnection,
            selectedNode: state.selectedNode,
            selectNode: state.selectNode,
            updateNodeData: state.updateNodeData
        }))
    );

    const saveWorkflow = useSaveWorkflow();
    const isSaving = usePluginBuilderStore((state) => state.isSaving);

    const handleSave = useCallback(async () => {
        if (isSaving) return;
        setSaveStatus('saving');
        try {
            const result = await saveWorkflow();
            if (result) {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
        } catch {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    }, [saveWorkflow, isSaving]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    const modifierNode = useMemo(() => {
        return nodes.find(n => n.type === NodeType.MODIFIER);
    }, [nodes]);

    const pluginName = useMemo(() => {
        const modifierData = modifierNode?.data as { modifier?: { name?: string } } | undefined;
        return modifierData?.modifier?.name || 'New Plugin';
    }, [modifierNode]);

    const handlePluginNameChange = useCallback((newName: string) => {
        if (modifierNode) {
            const currentData = modifierNode.data as { modifier?: Record<string, unknown> } | undefined;
            updateNodeData(modifierNode.id, {
                modifier: { ...currentData?.modifier, name: newName }
            });
        }
    }, [modifierNode, updateNodeData]);

    const onDragOver = useCallback((event: DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event: DragEvent) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow') as NodeType;
        if (!type || !reactFlowInstance) return;
        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY
        });
        addNode(type, position);
    }, [reactFlowInstance, addNode]);

    const onDragStart = useCallback((event: DragEvent, nodeType: NodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    }, []);

    const isValidConnection = useCallback((connection: Connection | { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) => {
        return validateConnection(connection as Connection);
    }, [validateConnection]);

    const handleClearSelection = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    const selectedNodeConfig = selectedNode ? NODE_CONFIGS[selectedNode.type as NodeType] : null;

    return (
        <Container className='plugin-builder-wrapper'>
            <Container className='plugin-builder-sidebar'>
                <Container className='plugin-builder-sidebar-header'>
                    {selectedNode ? (
                        <Container className='d-flex items-center gap-075'>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                size='sm'
                                onClick={handleClearSelection}
                            >
                                <TbArrowLeft size={18} />
                            </Button>
                            <Title className='font-weight-6'>{selectedNodeConfig?.label}</Title>
                        </Container>
                    ) : (
                        <EditableTag
                            as='h3'
                            onSave={handlePluginNameChange}
                            className='font-weight-6'
                        >
                            {pluginName}
                        </EditableTag>
                    )}
                </Container>

                <Container className='plugin-builder-sidebar-content'>
                    {selectedNode ? (
                        <NodeEditor node={selectedNode} />
                    ) : (
                        <PaletteContent onDragStart={onDragStart} />
                    )}
                </Container>
            </Container>

            <Container className='plugin-builder-canvas' ref={reactFlowWrapper}>
                {saveStatus !== 'idle' && (
                    <Container className={`plugin-builder-save-indicator plugin-builder-save-indicator--${saveStatus}`}>
                        {saveStatus === 'saving' && 'Saving...'}
                        {saveStatus === 'saved' && 'Saved!'}
                        {saveStatus === 'error' && 'Error saving'}
                    </Container>
                )}

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    onInit={setReactFlowInstance}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    isValidConnection={isValidConnection}
                    fitView
                    snapToGrid
                    snapGrid={[16, 16]}
                    defaultEdgeOptions={{
                        animated: true,
                        style: { stroke: '#64748b', strokeWidth: 2 }
                    }}
                >
                    <Background bgColor='#080808' color='#3d3d3d' gap={16} size={0.8} />
                </ReactFlow>
            </Container>
        </Container>
    );
};

export default PluginBuilder;
