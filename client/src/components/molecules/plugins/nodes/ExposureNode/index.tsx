import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';

const ExposureNode = memo((props: NodeProps) => {
    const { data } = props;
    const exposure = data.exposure || {};

    return(
        <BaseNode 
            {...props} 
            nodeType={NodeType.EXPOSURE}
            nodeTitle={exposure.name}
            description={exposure.results ? `Reading from ${exposure.results}` : `Configuration needed`}
        />
    );
});

export default ExposureNode;
