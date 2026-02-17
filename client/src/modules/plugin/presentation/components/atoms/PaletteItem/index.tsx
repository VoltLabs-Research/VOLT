import type { DragEvent } from 'react';
import type { NodeType } from '@/modules/plugin/domain/entities';
import type { NodeTypeConfig } from '@/modules/plugin/presentation/utilities/node-types';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';

interface PaletteItemProps {
    config: NodeTypeConfig;
    onDragStart: (event: DragEvent, nodeType: NodeType) => void;
    onAdd?: (nodeType: NodeType) => void;
};

const PaletteItem = ({ config, onDragStart, onAdd }: PaletteItemProps) => {
    const nodes = usePluginBuilderStore((state) => state.nodes);

    const isSingleton = config.inputs === 0;
    const alreadyExists = isSingleton && nodes.some(n => n.type === config.type);

    const handleClick = () => {
        if (alreadyExists) return;
        onAdd?.(config.type);
    };

    return (
        <Container
            className='d-flex gap-1-5 items-center cursor-pointer'
            draggable={!alreadyExists}
            onDragStart={alreadyExists ? undefined : (e) => onDragStart(e, config.type)}
            onClick={handleClick}
            style={alreadyExists ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
            <Container>
                <DynamicIcon iconName={config.icon} />
            </Container>
            <Container className='d-flex column'>
                <Title>{config.label}</Title>
                <Paragraph>{config.description}</Paragraph>
            </Container>
        </Container>
    );
};

export default PaletteItem;
