import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import BaseNode from '@/modules/plugin/components/plugin/atoms/BaseNode';

const ForEachNode = (props: NodeProps) => {
    return (
        <BaseNode
            {...props}
            nodeType={NodeType.FOREACH}
            description='Receives an array to iterate'
        />
    );
};

export default ForEachNode;
