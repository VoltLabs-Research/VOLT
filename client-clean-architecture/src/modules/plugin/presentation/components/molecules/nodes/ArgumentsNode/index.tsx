import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType, type IArgumentsData } from '@/modules/plugin/domain/entities';
import BaseNode from '@/modules/plugin/presentation/components/atoms/BaseNode';

const ArgumentsNode = memo((props: NodeProps) => {
    const { data } = props;
    const argumentsData = data.arguments as IArgumentsData;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.ARGUMENTS}
            description={`${argumentsData.arguments.length} argument(s)`}
        />
    );
});

ArgumentsNode.displayName = 'ArgumentsNode';

export default ArgumentsNode;
