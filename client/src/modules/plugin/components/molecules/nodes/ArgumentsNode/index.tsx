import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/workflow-enums';
import type { IArgumentsData } from '@/modules/plugin/api/entities/workflow';
import BaseNode from '@/modules/plugin/components/atoms/BaseNode';

const ArgumentsNode = (props: NodeProps) => {
    const { data } = props;
    const argumentsData = data.arguments as IArgumentsData;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.ARGUMENTS}
            description={`${argumentsData.arguments.length} argument(s)`}
        />
    );
};

export default ArgumentsNode;
