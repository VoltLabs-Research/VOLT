import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/features/plugins/components/atoms/BaseNode';

const ArgumentsNode = memo((props: NodeProps) => {
    const { data } = props;
    const args = data.arguments?.arguments || [];

    return(
        <BaseNode
            {...props}
            nodeType={NodeType.ARGUMENTS}
            description={`${args.length} argument(s)`}
        />
    );
});

ArgumentsNode.displayName = 'ArgumentsNode';
export default ArgumentsNode;
