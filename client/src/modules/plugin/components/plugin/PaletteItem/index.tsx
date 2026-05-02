import type { DragEvent } from 'react';
import type { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { NodeTypeConfig } from '@/modules/plugin/utilities/plugin/node-registry';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
interface PaletteItemProps {
    config: NodeTypeConfig;
    onDragStart: (event: DragEvent, nodeType: NodeType) => void;
    onAdd?: (nodeType: NodeType) => void;
}

const PaletteItem = ({ config, onDragStart, onAdd }: PaletteItemProps) => {
    const nodes = usePluginBuilderStore((state) => state.nodes);

    const isSingleton = config.inputs === 0;
    const alreadyExists = isSingleton && nodes.some(n => n.type === config.type);

    const handleClick = () => {
        if (alreadyExists) return;
        onAdd?.(config.type);
    };

    return (
        <Row gap='1-5' cursor='pointer' draggable={!alreadyExists} onDragStart={alreadyExists ? undefined : (e) => onDragStart(e, config.type)} onClick={handleClick} style={alreadyExists ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <div>
                <DynamicIcon iconName={config.icon} />
            </div>
            <Stack gap='05'>
                <h3>{config.label}</h3>
                <Text as='p' tone='muted'>{config.description}</Text>
            </Stack>
        </Row>
    );
};

export default PaletteItem;
