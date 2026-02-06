import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType, type IModifierData } from '@/modules/plugin/domain/entities';
import BaseNode from '@/modules/plugin/presentation/components/atoms/BaseNode';

const ModifierNode = memo((props: NodeProps) => {
    const { data } = props;
    const modifier = (data.modifier as IModifierData) || {};

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
