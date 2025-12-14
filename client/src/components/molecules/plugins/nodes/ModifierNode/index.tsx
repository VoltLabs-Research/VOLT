import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';

const ModifierNode = memo((props: NodeProps) => {
    const { data } = props;
    const modifier = data.modifier || {};

    return(
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
