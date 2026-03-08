import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import CanvasEmptyState from '@/modules/plugin/components/plugin/molecules/CanvasEmptyState';
import DebugContextPanel from '@/modules/plugin/components/plugin/molecules/DebugContextPanel';
import DebugToolbar from '@/modules/plugin/components/plugin/molecules/DebugToolbar';
import CanvasToolbar from '@/modules/plugin/components/plugin/molecules/CanvasToolbar';
import { nodeTypes } from '@/modules/plugin/components/plugin/molecules/nodes';
import FloatingNodePanel from '@/modules/plugin/components/plugin/organisms/FloatingNodePanel';
import useCanvasHandlers from '@/modules/plugin/hooks/plugin/use-canvas-handlers';
import usePluginDebugSocket from '@/modules/plugin/hooks/plugin/use-plugin-debug-socket';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import Container from '@/shared/presentation/components/Container';
import { Background, MiniMap, ReactFlow } from '@xyflow/react';
import { useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ReactFlowInstance } from '@xyflow/react';

const NODE_MINIMAP_COLORS: Record<string, string> = {
    [NodeType.MODIFIER]: '#0062FF',
    [NodeType.ARGUMENTS]: '#5e5ce6',
    [NodeType.CONTEXT]: '#64d2ff',
    [NodeType.FOREACH]: '#bf5af2',
    [NodeType.ENTRYPOINT]: '#2dcc70',
    [NodeType.EXPOSURE]: '#ff9f0a',
    [NodeType.EXPORT]: '#ff453a',
    [NodeType.IF_STATEMENT]: '#bf5af2'
};

const nodeColor = (node: { type?: string }) =>
    NODE_MINIMAP_COLORS[node.type ?? ''] ?? '#64748b';

interface PluginBuilderCanvasProps {
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    onSave: () => void;
};

const PluginBuilderCanvas = ({ saveStatus, onSave }: PluginBuilderCanvasProps) => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [currentZoom, setCurrentZoom] = useState(1);

    // Initialize debug socket subscriptions
    usePluginDebugSocket();

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

    const handleInit = useCallback((instance: ReactFlowInstance) => {
        setReactFlowInstance(instance);
        setCurrentZoom(instance.getZoom());
    }, []);

    const handleMoveEnd = useCallback((_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
        setCurrentZoom(viewport.zoom);
    }, []);

    const isEmpty = nodes.length === 0;

    return (
        <Container className='h-max w-max p-relative plugin-builder-canvas' ref={reactFlowWrapper}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onInit={handleInit}
                onMoveEnd={handleMoveEnd}
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
                <Background bgColor='#080808ff' color='rgb(116, 116, 116)' gap={16} size={0.8} />
                {!isEmpty && (
                    <MiniMap
                        nodeColor={nodeColor}
                        maskColor='rgba(0, 0, 0, 0.7)'
                        bgColor='#171719'
                    />
                )}
            </ReactFlow>

            {isEmpty && <CanvasEmptyState />}

            <FloatingNodePanel />

            <DebugToolbar />

            <DebugContextPanel />

            <CanvasToolbar saveStatus={saveStatus} onSave={onSave} zoom={currentZoom} />
        </Container>
    );
};

export default PluginBuilderCanvas;
