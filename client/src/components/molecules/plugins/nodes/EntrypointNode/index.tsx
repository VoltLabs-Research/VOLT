import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';

const EntrypointNode = memo((props: NodeProps) => {
    const { data } = props;
    const entrypoint = data.entrypoint || {};

    const hasBinary = !!(entrypoint.binary);
    const binaryDisplay = hasBinary
        ? (entrypoint.binary || 'Binary attached')
        : undefined;

    return(
        <BaseNode 
            {...props} 
            nodeType={NodeType.ENTRYPOINT}
            description={hasBinary ? binaryDisplay : 'No binary attached'}
        />
    );
});

EntrypointNode.displayName = 'EntrypointNode';
export default EntrypointNode;
