import type { DragEvent } from 'react';
import type { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { NodeTypeConfig } from '@/modules/plugin/utilities/plugin/node-registry';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import Container from '@/shared/presentation/components/Container';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';

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
