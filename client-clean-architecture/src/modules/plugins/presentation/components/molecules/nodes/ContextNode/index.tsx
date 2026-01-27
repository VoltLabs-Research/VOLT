import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import BaseNode from '@/modules/plugins/presentation/components/atoms/BaseNode';
import { CONTEXT_OPTIONS } from '@/modules/plugins/presentation/utilities/node-types';

const ContextNode = memo((props: NodeProps) => {
    const { data } = props;
    const source = (data as any).context?.source;
    const sourceLabel = CONTEXT_OPTIONS.find((option) => option.value === source)?.label || source;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.CONTEXT}
            description={`Using ${sourceLabel}`}
        />
    );
});

ContextNode.displayName = 'ContextNode';

export default ContextNode;
