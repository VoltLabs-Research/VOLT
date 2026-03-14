import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import Container from '@/shared/presentation/components/Container';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { useCallback } from 'react';
import type { DragEvent } from 'react';
import type { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { NodeTypeConfig } from '@/modules/plugin/utilities/plugin/node-registry';

interface PaletteItemProps {
    config: NodeTypeConfig;
    onDragStart: (event: DragEvent, nodeType: NodeType) => void;
    onAdd?: (nodeType: NodeType) => void;
};

const PaletteItem = ({ config, onDragStart, onAdd }: PaletteItemProps) => {
    const nodes = usePluginBuilderStore((state) => state.nodes);

    const isSingleton = config.inputs === 0;
    const alreadyExists = isSingleton && nodes.some((node) => node.type === config.type);
    const helperText = alreadyExists ? 'Already added' : isSingleton ? 'One per workflow' : 'Drag or click to add';

    const handleClick = useCallback(() => {
        if (alreadyExists) return;
        onAdd?.(config.type);
    }, [alreadyExists, config.type, onAdd]);

    const handleDragStart = useCallback((event: DragEvent<HTMLButtonElement>) => {
        if (alreadyExists) {
            return;
        }

        onDragStart(event, config.type);
    }, [alreadyExists, config.type, onDragStart]);

    return (
        <button
            type='button'
            className={`d-flex gap-1-5 items-center plugin-palette-item ${alreadyExists ? 'plugin-palette-item--disabled' : ''}`}
            draggable={!alreadyExists}
            disabled={alreadyExists}
            onDragStart={handleDragStart}
            onClick={handleClick}
            aria-label={`${config.label}. ${helperText}.`}
            title={`${config.label} — ${helperText}`}
        >
            <Container className='plugin-palette-item-icon' aria-hidden='true'>
                <DynamicIcon iconName={config.icon} />
            </Container>
            <Container className='d-flex column gap-025 plugin-palette-item-copy'>
                <Title className='plugin-palette-item-title'>{config.label}</Title>
                <Paragraph className='plugin-palette-item-description'>{config.description}</Paragraph>
                <Paragraph className={`font-size-1 plugin-palette-item-helper ${alreadyExists ? 'plugin-palette-item-helper--disabled' : ''}`}>
                    {helperText}
                </Paragraph>
            </Container>
        </button>
    );
};

export default PaletteItem;
