import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType, type IEntrypointData } from '@/modules/plugin/domain/entities';
import BaseNode from '@/modules/plugin/presentation/components/atoms/BaseNode';

const EntrypointNode = memo((props: NodeProps) => {
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
});

EntrypointNode.displayName = 'EntrypointNode';

export default EntrypointNode;
