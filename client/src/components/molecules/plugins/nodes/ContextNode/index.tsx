import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';
import { CONTEXT_OPTIONS } from '@/utilities/plugins/node-types';

const ContextNode = memo((props: NodeProps) => {
    const { data } = props;
    const source = data.context?.source;
    const sourceLabel = CONTEXT_OPTIONS.find((option) => option.value === source)?.label || source;

    return(
        <BaseNode 
            {...props} 
            nodeType={NodeType.CONTEXT}
            description={`Using ${sourceLabel}`}
        />
    )
});

ContextNode.displayName = 'ContextNode';
export default ContextNode;
