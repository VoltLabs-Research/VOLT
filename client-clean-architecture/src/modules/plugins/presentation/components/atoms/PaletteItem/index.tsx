import React from 'react';
import type { NodeType } from '@/modules/plugins/domain/entities';
import type { NodeTypeConfig } from '@/modules/plugins/presentation/utilities/node-types';
import DynamicIcon from '@/shared/presentation/components/atoms/common/DynamicIcon';
import Container from '@/shared/presentation/components/primitives/Container';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import './PaletteItem.css';

interface PaletteItemProps {
    onDragStart(event: React.DragEvent, nodeType: NodeType): void;
    config: NodeTypeConfig;
}

const PaletteItem: React.FC<PaletteItemProps> = ({ config, onDragStart }) => {
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
