import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/domain/entities';
import BaseNode from '@/modules/plugin/presentation/components/atoms/BaseNode';

const VisualizersNode = (props: NodeProps) => {
    return (
        <BaseNode
            {...props}
            nodeType={NodeType.VISUALIZERS}
            description='Exposure accessibility'
        />
    );
};

export default VisualizersNode;
