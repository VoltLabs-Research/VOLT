import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/features/plugins/components/atoms/BaseNode';

const VisualizersNode = memo((props: NodeProps) => {
    const { data } = props;
    const visualizers = data.visualizers || {};

    return(
        <BaseNode
            {...props}
            nodeType={NodeType.VISUALIZERS}
            description={'Exposure accessibility'}
        />
    );
});

export default VisualizersNode;
