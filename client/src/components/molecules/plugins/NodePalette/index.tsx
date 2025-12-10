import React from 'react';
import { NodeType } from '@/types/plugin';
import { NODE_CONFIGS, type NodeTypeConfig } from '@/utilities/plugins/node-types';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';

interface NodePaletteProps{
    onDragStart(event: React.DragEvent, nodeType: NodeType): void;
};

const NodePalette = ({ onDragStart }: NodePaletteProps) => {
    const nodeList = Object.values(NODE_CONFIGS);

    const handleDragStart = (event: React.DragEvent, config: NodeTypeConfig) => {
        event.dataTransfer.setData('application/reactflow', config.type);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(event, config.type);
    }

    return (
        <div className='node-palette-container'>
            <div className='node-palette-header-container'>
                <h3 className='node-palette-header-title'>Nodes</h3>
                <p className='node-palette-header-subtitle'>Drag to add to canvas</p>
            </div>

            <div className='node-palette-list-container'>
                {nodeList.map((config) => (
                    <div
                        key={config.type}
                        className='node-palette-item-container'
                        draggable
                        onDragStart={(e) => handleDragStart(e, config)}
                    >
                        <div className='node-palette-item-icon-container'>
                            <DynamicIcon iconName={config.icon} />
                        </div>
                        <div className='node-palette-item-content'>
                            <h3 className='node-palette-item-label'>{config.label}</h3>
                            <p className='node-palette-item-description'>{config.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NodePalette;