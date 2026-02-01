import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType, type IExportData } from '@/modules/plugin/domain/entities';
import BaseNode from '@/modules/plugin/presentation/components/atoms/BaseNode';
import { EXPORT_TYPE_OPTIONS } from '@/modules/plugin/presentation/utilities/node-types';

const ExportNode = memo((props: NodeProps) => {
    const { data } = props;
    const exportData = (data.export as IExportData) || {};
    const exportTypeLabel = EXPORT_TYPE_OPTIONS.find((v) => v.value === exportData.type)?.label;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.EXPORT}
            nodeTitle={exportData.exporter}
            description={exportData.type ? exportTypeLabel : 'Configuration needed'}
        />
    );
});

ExportNode.displayName = 'ExportNode';

export default ExportNode;
