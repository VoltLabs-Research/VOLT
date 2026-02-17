import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactFlow } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/domain/entities';
import { NODE_CONFIGS } from '@/modules/plugin/presentation/utilities/node-types';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import NodeEditor from '@/modules/plugin/presentation/components/molecules/NodeEditor';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import CloseButton from '@/shared/presentation/components/CloseButton';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';

const PANEL_WIDTH = 380;
const PANEL_MARGIN = 16;

const panelVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 8 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.97, y: 4 }
};

const FloatingNodePanel = () => {
    const selectedNode = usePluginBuilderStore((state) => state.selectedNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);
    const { flowToScreenPosition } = useReactFlow();
    const panelRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLElement | null>(null);
    const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

    const computePosition = useCallback((node: Node) => {
        const container = containerRef.current;
        if(!container) return { top: PANEL_MARGIN, right: PANEL_MARGIN };

        const containerRect = container.getBoundingClientRect();
        const nodeScreen = flowToScreenPosition({
            x: node.position.x + (node.measured?.width ?? 280),
            y: node.position.y
        });

        const relativeY = nodeScreen.y - containerRect.top;
        const maxTop = containerRect.height - PANEL_MARGIN;
        const clampedTop = Math.max(PANEL_MARGIN, Math.min(relativeY, maxTop));

        const nodeRightEdge = nodeScreen.x - containerRect.left + 24;
        const availableRight = containerRect.width - nodeRightEdge - PANEL_WIDTH - PANEL_MARGIN;
        const right = availableRight > 0
            ? containerRect.width - nodeRightEdge - PANEL_WIDTH
            : PANEL_MARGIN;

        return { top: clampedTop, right };
    }, [flowToScreenPosition]);

    useEffect(() => {
        if(!selectedNode) return;
        const pos = computePosition(selectedNode);
        setPosition(pos);
    }, [selectedNode?.id]);

    useEffect(() => {
        const canvas = document.querySelector('.plugin-builder-canvas');
        if(canvas instanceof HTMLElement){
            containerRef.current = canvas;
        }
    }, []);

    const handleClose = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    const config = selectedNode ? NODE_CONFIGS[selectedNode.type as NodeType] : null;

    return (
        <AnimatePresence mode='wait'>
            {selectedNode && config && position && (
                <motion.div
                    ref={panelRef}
                    className='floating-node-panel p-absolute overflow-hidden card-elevated d-flex column'
                    style={{ top: position.top, right: position.right }}
                    variants={panelVariants}
                    initial='hidden'
                    animate='visible'
                    exit='exit'
                    transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                    key={selectedNode.id}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Container className='d-flex items-center gap-075 floating-node-panel-header p-1'>
                        <Container className='d-flex flex-center floating-node-panel-icon radius-sm color-secondary'>
                            <DynamicIcon iconName={config.icon} />
                        </Container>
                        <Title className='font-size-3 font-weight-6 flex-1'>
                            {config.label}
                        </Title>
                        <CloseButton onClick={handleClose} />
                    </Container>

                    <Container className='floating-node-panel-body flex-1 min-h-0 y-auto'>
                        <NodeEditor node={selectedNode} />
                    </Container>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default FloatingNodePanel;
