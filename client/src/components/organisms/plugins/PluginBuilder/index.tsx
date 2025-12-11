import { useCallback, useMemo, useRef, useState } from 'react';
import { Background, ReactFlow, type ReactFlowInstance } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { nodeTypes } from '@/components/molecules/plugins/nodes';
import { NodeType } from '@/types/plugin';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';
import usePluginBuilderStore from '@/stores/plugin-builder';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import Sidebar from '@/components/organisms/common/Sidebar';
import PaletteItem from '@/components/atoms/plugins/PaletetteItem';
import NodeEditor from '@/components/molecules/plugins/NodeEditor';
import { TbArrowLeft } from 'react-icons/tb';
import './PluginBuilder.css';
import '@xyflow/react/dist/style.css';

const nodeTypesList = Object.values(NODE_CONFIGS);

const PaletteContent: React.FC<{ onDragStart: (e: React.DragEvent, type: NodeType) => void }> = ({ onDragStart }) => (
    <div className='plugin-builder-palette-list-container'>
        {nodeTypesList.map((config) => (
            <PaletteItem config={config} onDragStart={onDragStart} key={config.type} />
        ))}
    </div>
);

const OptionsContent = () => (
    <div className="plugin-builder-options-placeholder">
        <p>Select a node or add global plugin options here.</p>
    </div>
);

const PluginBuilder = () => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [activeTab, setActiveTab] = useState('Palette');

    // Suscripciones optimizadas con useShallow para el canvas
    const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeClick, onPaneClick, addNode, validateConnection } = 
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
                validateConnection: state.validateConnection
            }))
        );

    // Suscripción separada para el sidebar
    const selectedNode = usePluginBuilderStore((state) => state.selectedNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow') as NodeType;
        if(!type || !reactFlowInstance || !reactFlowWrapper.current) return;
        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top
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

    // Memoizar SIDEBAR_TAGS para evitar recreación en cada render
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
        <div className='plugin-builder-container'>
            <Sidebar 
                tags={SIDEBAR_TAGS} 
                activeTag={activeTab} 
                className='primary-surface'
                overrideContent={selectedNode ? <NodeEditor node={selectedNode} /> : null}
            >
                <Sidebar.Header>
                    {selectedNode ? (
                        <div className='plugin-sidebar-header-back'>
                            <button className='plugin-sidebar-back-btn' onClick={handleClearSelection}>
                                <TbArrowLeft size={18} />
                            </button>
                            <h3 className='plugin-sidebar-title'>{selectedNodeConfig?.label || 'Node'}</h3>
                        </div>
                    ) : (
                        <h3 className='plugin-sidebar-title'>New Plugin</h3>
                    )}
                </Sidebar.Header>
                
                <Sidebar.Bottom>
                    <div className='editor-sidebar-user-avatar-wrapper'>
                        <SidebarUserAvatar
                            avatarrounded={false}
                            hideEmail={true}
                        />
                    </div>
                </Sidebar.Bottom>
            </Sidebar>

            <div className='plugin-builder-canvas' ref={reactFlowWrapper}>
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
            </div>
        </div>
    );
};

export default PluginBuilder;