import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import BaseNode from '@/modules/plugins/presentation/components/atoms/BaseNode';

const VisualizersNode = memo((props: NodeProps) => {
    return (
        <BaseNode
            {...props}
            nodeType={NodeType.VISUALIZERS}
            description={'Exposure accessibility'}
        />
    );
});

VisualizersNode.displayName = 'VisualizersNode';

export default VisualizersNode;
