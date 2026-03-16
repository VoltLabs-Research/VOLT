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
import useTip from '@/shared/tips/use-tip';
import { Background, MiniMap, ReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ReactFlowInstance } from '@xyflow/react';

/** Reads a CSS custom property from the document root. */
const getCSSVar = (name: string): string =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Resolves all theme-dependent colors that ReactFlow needs as raw strings. */
const resolveThemeColors = () => ({
    minimapColors: {
        [NodeType.MODIFIER]: getCSSVar('--accent-blue'),
        [NodeType.ARGUMENTS]: getCSSVar('--accent-indigo'),
        [NodeType.CONTEXT]: getCSSVar('--accent-teal'),
        [NodeType.FOREACH]: getCSSVar('--accent-purple'),
        [NodeType.ENTRYPOINT]: getCSSVar('--accent-green'),
        [NodeType.PLUGIN]: getCSSVar('--accent-blue'),
        [NodeType.EXPOSURE]: getCSSVar('--accent-orange'),
        [NodeType.EXPORT]: getCSSVar('--accent-red'),
        [NodeType.IF_STATEMENT]: getCSSVar('--accent-purple')
    } as Record<string, string>,
    edgeStroke: getCSSVar('--color-border-strong'),
    canvasBg: getCSSVar('--color-bg'),
    gridColor: getCSSVar('--color-text-muted'),
    minimapMask: getCSSVar('--color-overlay'),
    minimapBg: getCSSVar('--color-surface-1'),
    nodeFallback: getCSSVar('--color-text-muted')
});

/** Returns resolved theme colors for ReactFlow, re-reading when the theme changes. */
const useCanvasThemeColors = () => {
    const [colors, setColors] = useState(resolveThemeColors);

    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.attributeName === 'data-theme') {
                    setColors(resolveThemeColors());
                }
            }
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    return colors;
};

interface PluginBuilderCanvasProps {
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    onSave: () => void;
};

const PluginBuilderCanvas = ({ saveStatus, onSave }: PluginBuilderCanvasProps) => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [currentZoom, setCurrentZoom] = useState(1);
    const themeColors = useCanvasThemeColors();

    const nodeColor = useCallback(
        (node: { type?: string }) => themeColors.minimapColors[node.type ?? ''] ?? themeColors.nodeFallback,
        [themeColors]
    );

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

    useTip('plugin-builder-get-started', {
        enabled: isEmpty
    });

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
                    style: { stroke: themeColors.edgeStroke, strokeWidth: 2 }
                }}
            >
                <Background bgColor={themeColors.canvasBg} color={themeColors.gridColor} gap={16} size={0.8} />
                {!isEmpty && (
                    <MiniMap
                        nodeColor={nodeColor}
                        maskColor={themeColors.minimapMask}
                        bgColor={themeColors.minimapBg}
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
