import React, { memo, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import './BaseNode.css';

interface BaseNodeProps extends NodeProps{
    children: ReactNode;
    nodeType: NodeType;
};

const BaseNode: React.FC<BaseNodeProps> = memo(({
    data,
    selected,
    children,
    nodeType
}) => {
    const config = NODE_CONFIGS[nodeType];

    return (
        <div className={`workflow-node ${selected ? 'workflow-node--selected' : ''}`}>
            {config.inputs > 0 && (
                <Handle
                    type='target'
                    position={Position.Left}
                    id='input'
                />
            )}

            <div className='workflow-node-header-container'>
                <span className='workflow-node-icon'>
                    <DynamicIcon iconName={config.icon} />
                </span>
                <div className='workflow-node-header-content'>
                    <h3 className='workflow-node-header-title'>{data.name || config.label}</h3>
                    <p className='workflow-node-header-type'>{config.label}</p>
                </div>
            </div>

            {/*
            <div className='workflow-node-body-container'>
                {children}
            </div>
            */}

            {config.outputs !== 0 && (
                <Handle
                    type='source'
                    position={Position.Right}
                    id='output'
                />
            )}
        </div>
    );
});

BaseNode.displayName = 'BaseNode';

export default BaseNode;