import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';

const ForEachNode = memo((props: NodeProps) => {
    const { data } = props;
    const iterableSource = data.forEach?.iterableSource;

    return(
        <BaseNode
            {...props}
            nodeType={NodeType.FOREACH}
            description={`Receives an array to iterate`}
        />
    );
});

ForEachNode.displayName = 'ForEachNode';

export default ForEachNode;
