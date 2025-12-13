import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';
import NodeField from '@/components/atoms/plugins/NodeField';

const ExposureNode = memo((props: NodeProps) => {
    const { data } = props;
    const exposure = data.exposure || {};

    return(
        <BaseNode {...props} nodeType={NodeType.EXPOSURE} nodeTitle={exposure.name}>
            <NodeField label='Name' value={exposure.name} />
            <NodeField label='Results File' value={exposure.results} code />
            <NodeField label='Iterable Path' value={exposure.iterable} code empty='(entire file)' />
        </BaseNode>
    );
});

export default ExposureNode;
