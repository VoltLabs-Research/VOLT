import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import BaseNode from '@/modules/plugins/presentation/components/atoms/BaseNode';

const ArgumentsNode = memo((props: NodeProps) => {
    const { data } = props;
    const args = (data as any).arguments?.arguments || [];

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.ARGUMENTS}
            description={`${args.length} argument(s)`}
        />
    );
});

ArgumentsNode.displayName = 'ArgumentsNode';

export default ArgumentsNode;
