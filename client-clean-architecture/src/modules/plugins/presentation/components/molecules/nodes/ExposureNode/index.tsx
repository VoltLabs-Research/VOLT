import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import BaseNode from '@/modules/plugins/presentation/components/atoms/BaseNode';

const ExposureNode = memo((props: NodeProps) => {
    const { data } = props;
    const exposure = (data as any).exposure || {};

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.EXPOSURE}
            nodeTitle={exposure.name}
            description={exposure.results ? `Reading from ${exposure.results}` : `Configuration needed`}
        />
    );
});

ExposureNode.displayName = 'ExposureNode';

export default ExposureNode;
