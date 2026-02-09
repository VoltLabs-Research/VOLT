import React, { type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/domain/entities';
import { NODE_CONFIGS } from '@/modules/plugin/presentation/utilities/node-types';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './BaseNode.css';

interface BaseNodeProps extends NodeProps {
    nodeType: NodeType;
    nodeTitle?: string;
    description?: string;
    children?: ReactNode;
};

const BaseNode = ({
    selected,
    nodeType,
    nodeTitle,
    description,
    children
}: BaseNodeProps) => {
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
                    <Title>{nodeTitle ?? config.label}</Title>

                    {description && (
                        <Paragraph className='color-muted overflow-hidden workflow-node-description'>
                            {description}
                        </Paragraph>
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
};

export default BaseNode;
