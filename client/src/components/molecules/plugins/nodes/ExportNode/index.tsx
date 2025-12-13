import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';
import NodeField from '@/components/atoms/plugins/NodeField';

const ExportNode = memo((props: NodeProps) => {
    const { data } = props;
    const exportData = data.export || {};
    const optionsCount = Object.keys(exportData.options || {}).length;

    return (
        <BaseNode {...props} nodeType={NodeType.EXPORT} nodeTitle={exportData.exporter}>
            <NodeField label='Exporter' value={exportData.exporter} />
            <NodeField label='Type' value={exportData.type} />
            <NodeField label='Options' value={`${optionsCount} options`} />
        </BaseNode>
    );
});

export default ExportNode;
