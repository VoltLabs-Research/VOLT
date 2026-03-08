import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/workflow-enums';
import type { IContextData } from '@/modules/plugin/api/entities/workflow';
import BaseNode from '@/modules/plugin/components/atoms/BaseNode';
import { CONTEXT_OPTIONS } from '@/modules/plugin/utilities/node-types';

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
