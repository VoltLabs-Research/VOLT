import { useCallback, useRef, useState } from 'react';
import { Background, ReactFlow, type ReactFlowInstance } from '@xyflow/react';
import { nodeTypes } from '@/components/molecules/plugins/nodes';
import { NodeType } from '@/types/plugin';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';
import useWorkflow from '@/hooks/plugins/use-workflow';
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import Sidebar from '@/components/organisms/common/Sidebar';
import '@xyflow/react/dist/style.css';
import './PluginBuilder.css';
import PaletteItem from '@/components/atoms/plugins/PaletetteItem';

const PluginBuilder = () => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [activeTab, setActiveTab] = useState('Palette');

    const {
        nodes,
        edges,
        selectedNode,
        onNodesChange,
        onConnect,
        onNodeClick,
        addNode,
        onEdgesChange,
        updateNodeData,
        deleteNode,
        getWorkflow,
        validateConnection
    } = useWorkflow();

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
    
    const nodeTypesList = Object.values(NODE_CONFIGS);

    const PaletteTag = () => (
        <div className='plugin-builder-palette-list-container'>
            {nodeTypesList.map((config) => (
                <PaletteItem config={config} onDragStart={onDragStart} />
            ))}
        </div>
    );

    const OptionsTag = () => (
        <div className="plugin-builder-options-placeholder">
            <p>Select a node or add global plugin options here.</p>
        </div>
    );

     const SIDEBAR_TAGS = [
        {
            id: "Palette",
            name: "Palette",
            Component: PaletteTag,
            props: {}
        },
        {
            id: "Options",
            name: "Options",
            Component: OptionsTag,
            props: {}
        }
    ];

    return (
        <div className='plugin-builder-container'>
            <Sidebar tags={SIDEBAR_TAGS} activeTag={activeTab} className='primary-surface'>
                <Sidebar.Header>
                    <h3 className='plugin-sidebar-title'>New Plugin</h3>
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
                    <Background color='#3d3d3dff' gap={16} size={0.8} />
                </ReactFlow>
            </div>
        </div>
    );
};

export default PluginBuilder;