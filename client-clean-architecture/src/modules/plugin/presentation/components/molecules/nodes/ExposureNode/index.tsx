import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType, type IExposureData } from '@/modules/plugin/domain/entities';
import BaseNode from '@/modules/plugin/presentation/components/atoms/BaseNode';

const ExposureNode = memo((props: NodeProps) => {
    const { data } = props;
    const exposure = (data.exposure as IExposureData) || {};

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.EXPOSURE}
            nodeTitle={exposure.name}
            description={exposure.results ? `Reading from ${exposure.results}` : 'Configuration needed'}
        />
    );
});

ExposureNode.displayName = 'ExposureNode';

export default ExposureNode;
