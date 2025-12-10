import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';
import NodeField from '@/components/atoms/plugins/NodeField';

const ForEachNode = memo((props: NodeProps) => {
    const { data } = props;
    const iterableSource = data.forEach?.iterableSource;

    return (
        <BaseNode {...props} nodeType={NodeType.FOREACH}>
            <NodeField
                label='Iterable Source'
                value={iterableSource}
                code
            />

            <NodeField
                label='Output'
                value='forEach.currentValue'
                code
            />
        </BaseNode>
    );
});

ForEachNode.displayName = 'ForEachNode';

export default ForEachNode;