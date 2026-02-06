import type { DragEvent } from 'react';
import type { NodeType } from '@/modules/plugin/domain/entities';
import type { NodeTypeConfig } from '@/modules/plugin/presentation/utilities/node-types';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';

interface PaletteItemProps {
    config: NodeTypeConfig;
    onDragStart: (event: DragEvent, nodeType: NodeType) => void;
};

const PaletteItem = ({ config, onDragStart }: PaletteItemProps) => {
    return (
        <Container
            className='d-flex gap-1-5 items-center'
            draggable
            onDragStart={(e) => onDragStart(e, config.type)}
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
