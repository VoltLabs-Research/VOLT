import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/workflow-enums';
import type { IEntrypointData } from '@/modules/plugin/api/entities/workflow';
import BaseNode from '@/modules/plugin/components/atoms/BaseNode';

const EntrypointNode = (props: NodeProps) => {
    const { data } = props;
    const entrypoint = (data.entrypoint as IEntrypointData) || {};

    const hasBinary = !!entrypoint.binary;
    const binaryDisplay = hasBinary
        ? (entrypoint.binary || 'Binary attached')
        : undefined;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.ENTRYPOINT}
            description={hasBinary ? binaryDisplay : 'No binary attached'}
        />
    );
};

export default EntrypointNode;
