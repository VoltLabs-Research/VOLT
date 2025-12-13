import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';
import NodeField from '@/components/atoms/plugins/NodeField';

const EntrypointNode = memo((props: NodeProps) => {
    const { data } = props;
    const entrypoint = data.entrypoint || {};
    const timeoutMinutes = Math.round((entrypoint.timeout || 300000) / 60000);

    const hasBinary = !!(entrypoint.binary || entrypoint.binaryObjectPath);
    const binaryDisplay = hasBinary
        ? (entrypoint.binaryFileName || entrypoint.binary || 'Binary attached')
        : undefined;

    return(
        <BaseNode {...props} nodeType={NodeType.ENTRYPOINT}>
            <NodeField label='Binary' value={binaryDisplay} code empty='No binary attached' />
            <NodeField label='Arguments Template' value={entrypoint.arguments || 'Not set'} />
        </BaseNode>
    );
});

EntrypointNode.displayName = 'EntrypointNode';
export default EntrypointNode;
