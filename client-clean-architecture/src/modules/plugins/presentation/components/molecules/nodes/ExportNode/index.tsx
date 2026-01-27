import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import BaseNode from '@/modules/plugins/presentation/components/atoms/BaseNode';
import { EXPORT_TYPE_OPTIONS } from '@/modules/plugins/presentation/utilities/node-types';

const ExportNode = memo((props: NodeProps) => {
    const { data } = props;
    const exportData = (data as any).export || {};

    const typeLabel = exportData.type
        ? EXPORT_TYPE_OPTIONS.find((v) => v.value === exportData.type)?.label
        : undefined;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.EXPORT}
            nodeTitle={exportData.exporter}
            description={typeLabel || 'Configuration needed'}
        />
    );
});

ExportNode.displayName = 'ExportNode';

export default ExportNode;
