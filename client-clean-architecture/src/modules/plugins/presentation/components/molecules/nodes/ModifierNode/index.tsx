import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import BaseNode from '@/modules/plugins/presentation/components/atoms/BaseNode';

const ModifierNode = memo((props: NodeProps) => {
    const { data } = props;
    const modifier = (data as any).modifier || {};

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.MODIFIER}
            nodeTitle={modifier.name}
            description={modifier.description}
        />
    );
});

ModifierNode.displayName = 'ModifierNode';

export default ModifierNode;
