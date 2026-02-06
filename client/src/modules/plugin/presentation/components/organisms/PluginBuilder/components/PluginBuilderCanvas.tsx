import { useRef, useState } from 'react';
import { Background, ReactFlow, type ReactFlowInstance } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { nodeTypes } from '@/modules/plugin/presentation/components/molecules/nodes';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import useCanvasHandlers from '../hooks/use-canvas-handlers';
import ProcessingLoader from '@/shared/presentation/components/ProcessingLoader';
import Container from '@/shared/presentation/components/Container';

interface PluginBuilderCanvasProps {
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
};

const PluginBuilderCanvas = ({ saveStatus }: PluginBuilderCanvasProps) => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        onNodeClick,
        onPaneClick
    } = usePluginBuilderStore(
        useShallow((state) => ({
            nodes: state.nodes,
            edges: state.edges,
            onNodesChange: state.onNodesChange,
            onEdgesChange: state.onEdgesChange,
            onConnect: state.onConnect,
            onNodeClick: state.onNodeClick,
            onPaneClick: state.onPaneClick
        }))
    );

    const { onDragOver, onDrop, isValidConnection } = useCanvasHandlers({ reactFlowInstance });

    return (
        <Container className='h-max w-max' ref={reactFlowWrapper}>
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
    );
};

export default PluginBuilderCanvas;
