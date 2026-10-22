import { CloseButton } from '@heroui/react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import NodeEditor from '@/modules/plugin/components/plugin/NodeEditor';
const PANEL_WIDTH = 400;
const PANEL_MARGIN = 16;
const PANEL_MIN_HEIGHT = 220;
const PANEL_VIEWPORT_RATIO = 0.75;

interface PanelPosition {
    top: number;
    right: number;
    maxHeight: number;
}

const FloatingNodePanel = () => {
    const selectedNode = usePluginBuilderStore((state) => state.selectedNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);
    const nodes = usePluginBuilderStore((state) => state.nodes);
    const { flowToScreenPosition } = useReactFlow();
    const viewport = useViewport();
    const containerRef = useRef<HTMLElement | null>(null);
    const [position, setPosition] = useState<PanelPosition | null>(null);

    const computePosition = useCallback((node: Node): PanelPosition => {
        const containerRect = containerRef.current?.getBoundingClientRect();
        const containerHeight = containerRect?.height ?? window.innerHeight;
        const containerWidth = containerRect?.width ?? window.innerWidth;
        const containerTop = containerRect?.top ?? 0;
        const containerLeft = containerRect?.left ?? 0;

        const viewportBound = Math.floor(window.innerHeight * PANEL_VIEWPORT_RATIO);
        const maxHeight = Math.max(
            PANEL_MIN_HEIGHT,
            Math.min(viewportBound, containerHeight - 2 * PANEL_MARGIN)
        );

        const nodeScreen = flowToScreenPosition({
            x: node.position.x + (node.measured?.width ?? 280),
            y: node.position.y
        });

        const relativeY = nodeScreen.y - containerTop;
        const maxTop = Math.max(PANEL_MARGIN, containerHeight - maxHeight - PANEL_MARGIN);
        const clampedTop = Math.max(PANEL_MARGIN, Math.min(relativeY, maxTop));

        const nodeRightEdge = nodeScreen.x - containerLeft + 24;
        const availableRight = containerWidth - nodeRightEdge - PANEL_WIDTH - PANEL_MARGIN;
        const right = availableRight > 0
            ? containerWidth - nodeRightEdge - PANEL_WIDTH
            : PANEL_MARGIN;

        return {
            top: clampedTop,
            right,
            maxHeight
        };
    }, [flowToScreenPosition]);

    const liveSelectedNode = selectedNode
        ? nodes.find((node) => node.id === selectedNode.id) ?? selectedNode
        : null;

    useEffect(() => {
        if (!liveSelectedNode) return;
        setPosition(computePosition(liveSelectedNode));
    }, [liveSelectedNode, viewport.x, viewport.y, viewport.zoom, computePosition]);

    useEffect(() => {
        const canvas = document.querySelector('.plugin-builder-canvas');
        if (canvas instanceof HTMLElement) {
            containerRef.current = canvas;
        }
    }, []);

    const config = liveSelectedNode ? NODE_CONFIGS[liveSelectedNode.type as NodeType] : null;

    if (!liveSelectedNode || !config || !position) {
        return null;
    }

    // Keyed by node, so each newly selected node's panel is a new element and rises in from its
    // @starting-style.
    return (
        <div
            key={liveSelectedNode.id}
            className='glass-surface absolute z-[100] flex w-[400px] max-w-[calc(100vw-1rem)] select-text flex-col overflow-hidden rounded-3xl bg-overlay shadow-[var(--overlay-shadow)] transition-[opacity,translate,scale] duration-200 ease-[var(--ease-emphasized)] starting:translate-y-2 starting:scale-96 starting:opacity-0 max-[768px]:fixed! max-[768px]:z-[300] max-[768px]:inset-auto! max-[768px]:bottom-2! max-[768px]:left-2! max-[768px]:right-2! max-[768px]:top-auto! max-[768px]:w-auto! max-[768px]:max-w-[calc(100vw-1rem)]! max-[768px]:max-h-[min(70dvh,560px)]'
            style={{
                top: position.top,
                right: position.right,
                maxHeight: position.maxHeight
            }}
            onClick={(event) => event.stopPropagation()}
        >
            <div className='flex shrink-0 flex-row items-center gap-3 pt-3.5 pr-2.5 pb-2.5 pl-5'>
                <h3 className='flex-1 text-base font-semibold text-foreground'>
                    {config.label}
                </h3>
                <CloseButton onPress={() => selectNode(null)} />
            </div>

            <NodeEditor node={liveSelectedNode} />
        </div>
    );
};

export default FloatingNodePanel;
