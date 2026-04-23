import { CloseButton } from '@/shared/presentation/primitives';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactFlow, useViewport } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-registry';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import NodeEditor from '@/modules/plugin/components/plugin/NodeEditor';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
const PANEL_WIDTH = 400;
const PANEL_MARGIN = 16;
const PANEL_MIN_HEIGHT = 220;
const PANEL_VIEWPORT_RATIO = 0.75;

interface PanelPosition {
    top: number;
    right: number;
    maxHeight: number;
};

const panelVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 8 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.97, y: 4 }
};

const FloatingNodePanel = () => {
    const selectedNode = usePluginBuilderStore((state) => state.selectedNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);
    const nodes = usePluginBuilderStore((state) => state.nodes);
    const { flowToScreenPosition } = useReactFlow();
    const viewport = useViewport();
    const panelRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLElement | null>(null);
    const [position, setPosition] = useState<PanelPosition | null>(null);

    const computePosition = useCallback((node: Node): PanelPosition => {
        const container = containerRef.current;
        const containerHeight = container?.getBoundingClientRect().height
            ?? (typeof window !== 'undefined' ? window.innerHeight : PANEL_MIN_HEIGHT + 2 * PANEL_MARGIN);
        const containerWidth = container?.getBoundingClientRect().width
            ?? (typeof window !== 'undefined' ? window.innerWidth : PANEL_WIDTH + 2 * PANEL_MARGIN);
        const containerTop = container?.getBoundingClientRect().top ?? 0;
        const containerLeft = container?.getBoundingClientRect().left ?? 0;

        const viewportBound = typeof window !== 'undefined'
            ? Math.floor(window.innerHeight * PANEL_VIEWPORT_RATIO)
            : containerHeight;
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

        return { top: clampedTop, right, maxHeight };
    }, [flowToScreenPosition]);

    const liveSelectedNode = selectedNode
        ? nodes.find((node) => node.id === selectedNode.id) ?? selectedNode
        : null;

    useEffect(() => {
        if (!liveSelectedNode) return;
        setPosition(computePosition(liveSelectedNode));
    }, [liveSelectedNode?.id, liveSelectedNode?.position.x, liveSelectedNode?.position.y, viewport.x, viewport.y, viewport.zoom, computePosition]);

    useEffect(() => {
        const canvas = document.querySelector('.plugin-builder-canvas');
        if (canvas instanceof HTMLElement) {
            containerRef.current = canvas;
        }
    }, []);

    const handleClose = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    const config = liveSelectedNode ? NODE_CONFIGS[liveSelectedNode.type as NodeType] : null;

    return (
        <AnimatePresence mode='wait'>
            {liveSelectedNode && config && position && (
                <motion.div
                    ref={panelRef}
                    className='floating-node-panel p-absolute overflow-hidden glass-bg d-flex column'
                    style={{ top: position.top, right: position.right, maxHeight: position.maxHeight }}
                    variants={panelVariants}
                    initial='hidden'
                    animate='visible'
                    exit='exit'
                    transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                    key={liveSelectedNode.id}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className='d-flex items-center gap-075 floating-node-panel-header p-1'>
                        <div className='d-flex flex-center floating-node-panel-icon radius-sm color-secondary'>
                            <DynamicIcon iconName={config.icon} />
                        </div>
                        <h3 className='font-size-3 font-weight-6 flex-1'>
                            {config.label}
                        </h3>
                        <CloseButton onClick={handleClose} />
                    </div>

                    <NodeEditor node={liveSelectedNode} />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default FloatingNodePanel;
