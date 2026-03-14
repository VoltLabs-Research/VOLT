import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import NodeEditor from '@/modules/plugin/components/plugin/molecules/NodeEditor';
import CloseButton from '@/shared/presentation/components/CloseButton';
import Container from '@/shared/presentation/components/Container';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Title from '@/shared/presentation/components/Title';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-registry';
import { useReactFlow, useViewport } from '@xyflow/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Node } from '@xyflow/react';

const PANEL_WIDTH = 380;
const PANEL_MARGIN = 16;

interface PanelPosition {
    top: number;
    right: number;
    width: number;
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
    const prefersReducedMotion = useReducedMotion();
    const panelRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLElement | null>(null);
    const [position, setPosition] = useState<PanelPosition | null>(null);

    const computePosition = useCallback((node: Node) => {
        const container = containerRef.current;
        if (!container) {
            return {
                top: PANEL_MARGIN,
                right: PANEL_MARGIN,
                width: PANEL_WIDTH
            };
        }

        const containerRect = container.getBoundingClientRect();
        const panelWidth = Math.min(PANEL_WIDTH, Math.max(280, containerRect.width - (PANEL_MARGIN * 2)));
        const nodeScreen = flowToScreenPosition({
            x: node.position.x + (node.measured?.width ?? 280),
            y: node.position.y
        });

        const relativeY = nodeScreen.y - containerRect.top;
        const maxTop = containerRect.height - PANEL_MARGIN;
        const clampedTop = Math.max(PANEL_MARGIN, Math.min(relativeY, maxTop));

        const nodeRightEdge = nodeScreen.x - containerRect.left + 24;
        const availableRight = containerRect.width - nodeRightEdge - panelWidth - PANEL_MARGIN;
        const right = availableRight > 0
            ? Math.max(PANEL_MARGIN, containerRect.width - nodeRightEdge - panelWidth)
            : PANEL_MARGIN;

        return {
            top: clampedTop,
            right,
            width: panelWidth
        };
    }, [flowToScreenPosition]);

    const liveSelectedNode = selectedNode
        ? nodes.find((node) => node.id === selectedNode.id) ?? selectedNode
        : null;

    useEffect(() => {
        if (!liveSelectedNode) {
            return;
        }

        const pos = computePosition(liveSelectedNode);
        setPosition(pos);
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

    const handlePanelClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    }, []);

    const config = liveSelectedNode ? NODE_CONFIGS[liveSelectedNode.type as NodeType] : null;
    const panelTransition = {
        duration: prefersReducedMotion ? 0 : 0.18
    };

    return (
        <AnimatePresence mode='wait'>
            {liveSelectedNode && config && position && (
                <motion.div
                    ref={panelRef}
                    className='floating-node-panel p-absolute overflow-hidden card-elevated d-flex column'
                    style={{ top: position.top, right: position.right, width: position.width }}
                    variants={panelVariants}
                    initial='hidden'
                    animate='visible'
                    exit='exit'
                    transition={panelTransition}
                    key={liveSelectedNode.id}
                    onClick={handlePanelClick}
                    role='dialog'
                    aria-label={`${config.label} settings`}
                    aria-modal='false'
                >
                    <Container className='d-flex items-center gap-075 floating-node-panel-header p-1'>
                        <Container className='d-flex flex-center floating-node-panel-icon radius-sm color-secondary'>
                            <DynamicIcon iconName={config.icon} />
                        </Container>
                        <Title className='font-size-3 font-weight-6 flex-1'>
                            {config.label}
                        </Title>
                        <CloseButton onClick={handleClose} aria-label='Close node editor' />
                    </Container>

                    <Container className='floating-node-panel-body flex-1 min-h-0 y-auto'>
                        <NodeEditor node={liveSelectedNode} />
                    </Container>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default FloatingNodePanel;
