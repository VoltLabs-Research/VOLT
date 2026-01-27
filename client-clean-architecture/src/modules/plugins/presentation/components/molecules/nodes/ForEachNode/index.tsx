import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import BaseNode from '@/modules/plugins/presentation/components/atoms/BaseNode';

const ForEachNode = memo((props: NodeProps) => {
    return (
        <BaseNode
            {...props}
            nodeType={NodeType.FOREACH}
            description={`Receives an array to iterate`}
        />
    );
});

ForEachNode.displayName = 'ForEachNode';

export default ForEachNode;
