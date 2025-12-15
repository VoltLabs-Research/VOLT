import React from 'react';
import type { NodeType } from '@/types/plugin';
import type { NodeTypeConfig } from '@/utilities/plugins/node-types';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import './PaletteItem.css';

interface PaletteItemProps{
    onDragStart(event: React.DragEvent, nodeType: NodeType): void,
    config: NodeTypeConfig;
};

const PaletteItem = ({ config, onDragStart }: PaletteItemProps) => {

    return(
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
