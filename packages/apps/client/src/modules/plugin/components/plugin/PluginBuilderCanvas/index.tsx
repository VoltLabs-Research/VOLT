import { NodeType } from '@volt/contracts/modules/plugin/enums';
import CanvasEmptyState from '@/modules/plugin/components/plugin/CanvasEmptyState';
import DebugContextPanel from '@/modules/plugin/components/plugin/DebugContextPanel';
import DebugToolbar from '@/modules/plugin/components/plugin/DebugToolbar';
import CanvasToolbar from '@/modules/plugin/components/plugin/CanvasToolbar';
import { nodeTypes } from '@/modules/plugin/components/plugin/nodes';
import FloatingNodePanel from '@/modules/plugin/components/plugin/FloatingNodePanel';
import useCanvasHandlers from './use-canvas-handlers';
import usePluginDebugSocket from '@/modules/plugin/hooks/plugin/use-plugin-debug-socket';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import useTip from '@/shared/tips/use-tip';
import { useColorScheme } from '@/shared/ui/hooks/use-color-scheme';
import type { SaveStatus } from '@/modules/plugin/hooks/plugin/use-workflow-save-status';
import { Background, MiniMap, ReactFlow } from '@xyflow/react';
import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ReactFlowInstance } from '@xyflow/react';

// Each node type keeps its colour in the minimap. React Flow paints with these values through
// inline styles and CSS variables, so the theme tokens can be passed as they are.
const MINIMAP_NODE_COLORS: Record<string, string> = {
    [NodeType.MODIFIER]: 'var(--accent)',
    [NodeType.ARGUMENTS]: 'var(--accent-indigo)',
    [NodeType.CONTEXT]: 'var(--accent-teal)',
    [NodeType.FOREACH]: 'var(--accent-purple)',
    [NodeType.ENTRYPOINT]: 'var(--success)',
    [NodeType.PLUGIN]: 'var(--accent)',
    [NodeType.EXPOSURE]: 'var(--warning)',
    [NodeType.EXPORT]: 'var(--danger)',
    [NodeType.IF_STATEMENT]: 'var(--accent-purple)',
    [NodeType.SWITCH_STATEMENT]: 'var(--warning)',
    [NodeType.SWITCH_CASE]: 'var(--accent)'
};

const MINIMAP_SIZE = {
    width: 176,
    height: 112
};

const minimapNodeColor = (node: { type?: string }) => MINIMAP_NODE_COLORS[node.type ?? ''] ?? 'var(--muted)';

interface PluginBuilderCanvasProps {
    saveStatus: SaveStatus;
    onSave: () => void;
}

const PluginBuilderCanvas = ({ saveStatus, onSave }: PluginBuilderCanvasProps) => {
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [currentZoom, setCurrentZoom] = useState(1);
    // React Flow puts its colour mode on its root as a .light or .dark class, which also scopes
    // the theme tokens: it has to follow the app's theme, or the canvas repaints in light.
    const colorScheme = useColorScheme();
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

    useTip('plugin-builder-get-started', {
        enabled: isEmpty
    });

    return (
        <div className='relative w-full h-full plugin-builder-canvas'>
            <ReactFlow
                colorMode={colorScheme}
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
            >
                <Background bgColor='var(--canvas)' color='color-mix(in oklab, var(--foreground) 15%, transparent)' gap={16} size={2} />
                {!isEmpty && (
                    <MiniMap
                        className='glass-surface'
                        style={MINIMAP_SIZE}
                        nodeColor={minimapNodeColor}
                        nodeBorderRadius={2}
                        maskColor='color-mix(in oklab, var(--canvas) 62%, transparent)'
                        bgColor='var(--dashboard-surface)'
                    />
                )}
            </ReactFlow>

            {isEmpty && <CanvasEmptyState />}

            <FloatingNodePanel />

            <DebugToolbar />

            <DebugContextPanel />

            <CanvasToolbar saveStatus={saveStatus} onSave={onSave} zoom={currentZoom} />
        </div>
    );
};

export default PluginBuilderCanvas;
