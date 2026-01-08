import React, { memo, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import { NODE_CONFIGS } from '@/features/plugins/utilities/node-types';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import '@/features/plugins/components/atoms/BaseNode/BaseNode.css';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';

interface BaseNodeProps extends NodeProps {
    nodeType: NodeType;
    nodeTitle?: undefined;
    description?: string;
    children?: React.ReactNode;
};

const BaseNode: React.FC<BaseNodeProps> = memo(({
    data,
    selected,
    nodeType,
    nodeTitle,
    description,
    children,
}) => {
    const config = NODE_CONFIGS[nodeType];

    return (
        <Container className={`workflow-node ${selected ? 'workflow-node--selected' : ''}`}>
            {config.inputs > 0 && (
                <Handle
                    type='target'
                    position={Position.Left}
                    id='input'
                />
            )}

            <Container className='d-flex items-center gap-1'>
                <span className='workflow-node-icon'>
                    <DynamicIcon iconName={config.icon} />
                </span>
                <Container className='d-flex column gap-02'>
                    <Title>{nodeTitle ? nodeTitle : config.label}</Title>

                    {description && (
                        <Paragraph className='color-muted overflow-hidden workflow-node-description'>{description}</Paragraph>
                    )}
                </Container>
            </Container>

            {children}

            {!children && config.outputs !== 0 && (
                <Handle
                    type='source'
                    position={Position.Right}
                    id='output'
                />
            )}
        </Container>
    );
});

BaseNode.displayName = 'BaseNode';

export default BaseNode;
