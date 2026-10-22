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

    return (
        <button
            type='button'
            className='flex w-full cursor-grab flex-col gap-0.5 rounded-lg px-4 py-3 text-left transition-[background-color,opacity] duration-150 hover:bg-foreground/5 disabled:pointer-events-none disabled:opacity-40'
            draggable={!alreadyExists}
            disabled={alreadyExists}
            onDragStart={(event) => onDragStart(event, config.type)}
            onClick={() => onAdd?.(config.type)}
        >
            <span className='text-base font-medium text-foreground'>{config.label}</span>
            <span className='text-sm text-muted'>{config.description}</span>
        </button>
    );
};

export default PaletteItem;
