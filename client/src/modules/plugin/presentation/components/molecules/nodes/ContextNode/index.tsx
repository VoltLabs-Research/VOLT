import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType, type IContextData } from '@/modules/plugin/domain/entities';
import BaseNode from '@/modules/plugin/presentation/components/atoms/BaseNode';
import { CONTEXT_OPTIONS } from '@/modules/plugin/presentation/utilities/node-types';

const ContextNode = (props: NodeProps) => {
    const { data } = props;
    const source = (data.context as IContextData)?.source;
    const sourceLabel = CONTEXT_OPTIONS.find((option) => option.value === source)?.label || source;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.CONTEXT}
            description={`Using ${sourceLabel}`}
        />
    );
};

export default ContextNode;
