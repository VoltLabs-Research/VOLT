import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/workflow-enums';
import type { IModifierData } from '@/modules/plugin/api/entities/workflow';
import BaseNode from '@/modules/plugin/components/atoms/BaseNode';

const ModifierNode = (props: NodeProps) => {
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
};

export default ModifierNode;
