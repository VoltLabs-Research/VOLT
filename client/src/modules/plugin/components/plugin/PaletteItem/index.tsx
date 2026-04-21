import type { DragEvent } from 'react';
import type { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { NodeTypeConfig } from '@/modules/plugin/utilities/plugin/node-registry';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
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
        <div className='volt-container d-flex gap-1-5 items-center cursor-pointer' draggable={!alreadyExists} onDragStart={alreadyExists ? undefined : (e) => onDragStart(e, config.type)} onClick={handleClick} style={alreadyExists ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <div className="volt-container">
                <DynamicIcon iconName={config.icon} />
            </div>
            <div className='volt-container d-flex column gap-05'>
                <h3 className="volt-title">{config.label}</h3>
                <p className='volt-text color-muted'>{config.description}</p>
            </div>
        </div>
    );
};

export default PaletteItem;
