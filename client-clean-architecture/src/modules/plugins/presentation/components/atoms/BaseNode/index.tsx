import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import { NODE_CONFIGS } from '@/modules/plugins/presentation/utilities/node-types';
import DynamicIcon from '@/shared/presentation/components/atoms/common/DynamicIcon';
import Container from '@/shared/presentation/components/primitives/Container';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import './BaseNode.css';

interface BaseNodeProps extends NodeProps {
    nodeType: NodeType;
    nodeTitle?: string;
    description?: string;
    children?: React.ReactNode;
}

const BaseNode: React.FC<BaseNodeProps> = memo(({
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
