import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { IExposureData } from '@/modules/plugin/api/entities/plugin/workflow';
import BaseNode from '@/modules/plugin/components/plugin/BaseNode';

const ExposureNode = (props: NodeProps) => {
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
};

export default ExposureNode;
