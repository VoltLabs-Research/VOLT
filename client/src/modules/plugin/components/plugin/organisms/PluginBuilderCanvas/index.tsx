import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import CanvasEmptyState from '@/modules/plugin/components/plugin/molecules/CanvasEmptyState';
import DebugContextPanel from '@/modules/plugin/components/plugin/molecules/DebugContextPanel';
import DebugToolbar from '@/modules/plugin/components/plugin/molecules/DebugToolbar';
import CanvasToolbar from '@/modules/plugin/components/plugin/molecules/CanvasToolbar';
import { nodeTypes } from '@/modules/plugin/components/plugin/molecules/nodes';
import FloatingNodePanel from '@/modules/plugin/components/plugin/organisms/FloatingNodePanel';
import { PluginBuilderSaveStatus } from '@/modules/plugin/components/plugin/organisms/PluginBuilder/save-status';
import useCanvasHandlers from '@/modules/plugin/hooks/plugin/use-canvas-handlers';
import usePluginDebugSocket from '@/modules/plugin/hooks/plugin/use-plugin-debug-socket';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import Container from '@/shared/presentation/components/Container';
import { Background, MiniMap, ReactFlow } from '@xyflow/react';
import { useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ReactFlowInstance } from '@xyflow/react';

interface NodeColorInput {
    type?: string;
};

interface ViewportPosition {
    x: number;
    y: number;
    zoom: number;
};

const NODE_MINIMAP_COLORS: Record<string, string> = {
    [NodeType.MODIFIER]: 'var(--accent-blue)',
    [NodeType.ARGUMENTS]: 'var(--accent-indigo)',
    [NodeType.CONTEXT]: 'var(--accent-blue)',
    [NodeType.FOREACH]: 'var(--accent-purple)',
    [NodeType.ENTRYPOINT]: 'var(--accent-green)',
    [NodeType.EXPOSURE]: 'var(--accent-orange)',
    [NodeType.EXPORT]: 'var(--accent-red)',
    [NodeType.IF_STATEMENT]: 'var(--accent-purple)'
};

const nodeColor = (node: NodeColorInput) =>
    NODE_MINIMAP_COLORS[node.type ?? ''] ?? 'var(--color-border-strong)';

interface PluginBuilderCanvasProps {
    saveStatus: PluginBuilderSaveStatus;
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

    const handleMoveEnd = useCallback((_event: unknown, viewport: ViewportPosition) => {
        setCurrentZoom(viewport.zoom);
    }, []);

    const isEmpty = nodes.length === 0;

    return (
        <Container className='h-max w-max p-relative plugin-builder-canvas' ref={reactFlowWrapper}>
            <ReactFlow
                className='plugin-builder-flow'
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
                    style: { stroke: 'var(--color-border-strong)', strokeWidth: 2 }
                }}
                style={{ backgroundColor: 'var(--color-surface-1)' }}
            >
                <Background bgColor='var(--color-surface-1)' color='var(--plugin-canvas-grid)' gap={16} size={0.8} />
                {!isEmpty && (
                    <MiniMap
                        nodeColor={nodeColor}
                        maskColor='var(--plugin-canvas-minimap-mask)'
                        bgColor='var(--color-surface-2)'
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
