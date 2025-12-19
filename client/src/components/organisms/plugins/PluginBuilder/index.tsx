import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, ReactFlow, type ReactFlowInstance } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { nodeTypes } from '@/components/molecules/plugins/nodes';
import { NodeType } from '@/types/plugin';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';
import usePluginBuilderStore from '@/stores/plugins/plugin-builder';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import Sidebar from '@/components/organisms/common/Sidebar';
import PaletteItem from '@/components/atoms/plugins/PaletetteItem';
import NodeEditor from '@/components/molecules/plugins/NodeEditor';
import EditableTag from '@/components/atoms/common/EditableTag';
import Container from '@/components/primitives/Container';
import Button from '@/components/primitives/Button';
import { TbArrowLeft } from 'react-icons/tb';
import Paragraph from '@/components/primitives/Paragraph';
import '@xyflow/react/dist/style.css';
import './PluginBuilder.css';
import Title from '@/components/primitives/Title';
import ProcessingLoader from '@/components/atoms/common/ProcessingLoader';

const nodeTypesList = Object.values(NODE_CONFIGS);

const PaletteContent: React.FC<{ onDragStart: (e: React.DragEvent, type: NodeType) => void }> = ({ onDragStart }) => (
    <Container className='d-flex column gap-1-5 plugin-builder-palette-list-container'>
        {nodeTypesList.map((config) => (
            <PaletteItem config={config} onDragStart={onDragStart} key={config.type} />
        ))}
    </Container>
);

const OptionsContent = () => (
    <Container>
        <Paragraph>Select a node or add global plugin options here.</Paragraph>
    </Container>
);

const PluginBuilder = () => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [activeTab, setActiveTab] = useState('Palette');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeClick, onPaneClick, addNode, validateConnection, saveWorkflow, isSaving, saveError, currentPlugin } =
        usePluginBuilderStore(
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
                saveWorkflow: state.saveWorkflow,
                isSaving: state.isSaving,
                saveError: state.saveError,
                currentPlugin: state.currentPlugin
            }))
        );

    const handleSave = useCallback(async() => {
        if(isSaving) return;
        setSaveStatus('saving');
        const result = await saveWorkflow();
        if(result){
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }else{
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    }, [saveWorkflow, isSaving]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    const selectedNode = usePluginBuilderStore((state) => state.selectedNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);

    const modifierNode = useMemo(() => {
        return nodes.find(n => n.type === NodeType.MODIFIER);
    }, [nodes]);

    const pluginName = useMemo(() => {
        const modifierData = modifierNode?.data as { modifier?: { name?: string } } | undefined;
        return modifierData?.modifier?.name || 'New Plugin';
    }, [modifierNode]);

    const handlePluginNameChange = useCallback((newName: string) => {
        if(modifierNode){
            const currentData = modifierNode.data as { modifier?: Record<string, any> } | undefined;
            updateNodeData(modifierNode.id, {
                modifier: { ...currentData?.modifier, name: newName }
            });
        }
    }, [modifierNode, updateNodeData]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow') as NodeType;
        if(!type || !reactFlowInstance) return;
        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY
        });
        addNode(type, position);
    }, [reactFlowInstance, addNode]);

    const onDragStart = useCallback((event: React.DragEvent, nodeType: NodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    }, []);

    const isValidConnection = useCallback((connection: any) => {
        return validateConnection(connection);
    }, [validateConnection]);

    const handleClearSelection = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    const SIDEBAR_TAGS = useMemo(() => [
        {
            id: "Palette",
            name: "Palette",
            Component: () => <PaletteContent onDragStart={onDragStart} />
        },
        {
            id: "Options",
            name: "Options",
            Component: OptionsContent
        }
    ], [onDragStart]);

    const selectedNodeConfig = selectedNode ? NODE_CONFIGS[selectedNode.type as NodeType] : null;

    return (
        <Container className='wh-max vh-max'>
            <Sidebar
                tags={SIDEBAR_TAGS}
                activeTag={activeTab}
                className='primary-surface'
                overrideContent={selectedNode ? <NodeEditor node={selectedNode} /> : null}
            >
                <Sidebar.Header>
                    {selectedNode ? (
                        <Container className='d-flex items-center gap-075'>
                            <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleClearSelection}>
                                <TbArrowLeft size={18} />
                            </Button>
                            <Title className='font-weight-6'>{selectedNodeConfig?.label}</Title>
                        </Container>
                    ) : (
                        <EditableTag
                            as='h3'
                            onSave={handlePluginNameChange}
                            title='Double-click to edit plugin name'
                            children={pluginName}
                        />
                    )}
                </Sidebar.Header>

                <Sidebar.Bottom>
                    <Container className='editor-sidebar-user-avatar-wrapper'>
                        <SidebarUserAvatar
                            avatarrounded={false}
                            hideEmail={true}
                        />
                    </Container>
                </Sidebar.Bottom>
            </Sidebar>

            <Container
                className='h-max w-max'
                ref={reactFlowWrapper}
            >
                {saveStatus === 'saving' && (
                    <Container className='d-flex items-center gap-05 bottom-1 right-1 z-20 p-absolute'>
                        <ProcessingLoader
                            message='Saving workflow...'
                            completionRate={0}
                            isVisible={true}
                        />
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
                    <Background bgColor='#080808ff' color='#3d3d3dff' gap={16} size={0.8} />
                </ReactFlow>
            </Container>
        </Container>
    );
};

export default PluginBuilder;
