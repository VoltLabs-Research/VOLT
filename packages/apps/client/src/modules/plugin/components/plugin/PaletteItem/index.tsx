import type { DragEvent } from 'react';
import type { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { NodeTypeConfig } from '@/modules/plugin/utils/plugin/node-registry';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
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
        <div className='flex flex-row items-center gap-6 cursor-pointer' draggable={!alreadyExists} onDragStart={alreadyExists ? undefined : (e) => onDragStart(e, config.type)} onClick={handleClick} style={alreadyExists ? {
            opacity: 0.4,
            pointerEvents: 'none'
        } : undefined}>
            <div className='flex flex-col gap-2'>
                <h3>{config.label}</h3>
                <p className='text-muted'>{config.description}</p>
            </div>
        </div>
    );
};

export default PaletteItem;
