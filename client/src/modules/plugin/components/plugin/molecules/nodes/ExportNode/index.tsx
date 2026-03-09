import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { IExportData } from '@/modules/plugin/api/entities/plugin/workflow';
import BaseNode from '@/modules/plugin/components/plugin/atoms/BaseNode';
import { EXPORT_TYPE_OPTIONS } from '@/modules/plugin/utilities/plugin/node-registry';

const ExportNode = (props: NodeProps) => {
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
};

export default ExportNode;
