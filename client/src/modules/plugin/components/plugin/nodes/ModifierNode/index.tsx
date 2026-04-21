import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { IModifierData } from '@/modules/plugin/api/entities/plugin/workflow';
import BaseNode from '@/modules/plugin/components/plugin/BaseNode';

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
