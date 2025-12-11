import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';
import NodeField from '@/components/atoms/plugins/NodeField';

const ModifierNode = memo((props: NodeProps) => {
    const { data } = props;
    const modifier = data.modifier || {};

    return (
        <BaseNode {...props} nodeType={NodeType.MODIFIER}>
            <NodeField label='Name' value={modifier.name} />
            <NodeField label='Version' value={modifier.version} />
            <NodeField label='Author' value={modifier.author} />
        </BaseNode>
    );
});

ModifierNode.displayName = 'ModifierNode';

export default ModifierNode;