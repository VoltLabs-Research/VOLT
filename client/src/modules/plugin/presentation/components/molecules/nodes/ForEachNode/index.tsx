import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/domain/entities';
import BaseNode from '@/modules/plugin/presentation/components/atoms/BaseNode';

const ForEachNode = memo((props: NodeProps) => {
    return (
        <BaseNode
            {...props}
            nodeType={NodeType.FOREACH}
            description='Receives an array to iterate'
        />
    );
});

ForEachNode.displayName = 'ForEachNode';

export default ForEachNode;
