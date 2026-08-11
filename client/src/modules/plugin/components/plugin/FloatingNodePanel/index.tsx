import { CloseButton } from '@heroui/react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const panelVariants = {
    hidden: {
        opacity: 0,
        scale: 0.95,
        y: 8
    },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0
    },
    exit: {
        opacity: 0,
        scale: 0.97,
        y: 4
    }
};

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

    return (
        <AnimatePresence mode='wait'>
            {liveSelectedNode && config && position && (
                <motion.div
                    className='absolute z-[100] flex w-[400px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--overlay-shadow)] max-[768px]:fixed! max-[768px]:inset-auto! max-[768px]:bottom-2! max-[768px]:left-2! max-[768px]:right-2! max-[768px]:top-auto! max-[768px]:w-auto! max-[768px]:max-w-[calc(100vw-1rem)]! max-[768px]:max-h-[min(70dvh,560px)] max-[768px]:rounded-xl'
                    style={{
                        top: position.top,
                        right: position.right,
                        maxHeight: position.maxHeight
                    }}
                    variants={panelVariants}
                    initial='hidden'
                    animate='visible'
                    exit='exit'
                    transition={{
                        duration: 0.18,
                        ease: [0.32, 0.72, 0, 1]
                    }}
                    key={liveSelectedNode.id}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className='flex shrink-0 flex-row items-center gap-3 border-b border-border p-4'>
                        <h3 className='flex-1 text-base font-semibold text-foreground'>
                            {config.label}
                        </h3>
                        <CloseButton onPress={() => selectNode(null)} />
                    </div>

                    <NodeEditor node={liveSelectedNode} />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default FloatingNodePanel;
