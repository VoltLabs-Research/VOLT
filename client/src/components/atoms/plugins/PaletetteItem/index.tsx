import React from 'react';
import type { NodeType } from '@/types/plugin';
import type { NodeTypeConfig } from '@/utilities/plugins/node-types';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import './PaletteItem.css';

interface PaletteItemProps{
    onDragStart(event: React.DragEvent, nodeType: NodeType): void,
    config: NodeTypeConfig;
};

const PaletteItem = ({ config, onDragStart }: PaletteItemProps) => {

    return(
        <div
            className='plugin-palette-item-container'
            draggable
            onDragStart={(e) => onDragStart(e, config.type)}
        >
            <div className='plugin-palette-item-icon'>
                <DynamicIcon iconName={config.icon} />
            </div>
            <div className='plugin-palette-item-content'>
                <h3 className='plugin-palette-item-label'>{config.label}</h3>
                <p className='plugin-palette-item-description'>{config.description}</p>
            </div>
        </div>
    );
};

export default PaletteItem;
