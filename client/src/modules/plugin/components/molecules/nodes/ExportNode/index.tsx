import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/workflow-enums';
import type { IExportData } from '@/modules/plugin/api/entities/workflow';
import BaseNode from '@/modules/plugin/components/atoms/BaseNode';
import { EXPORT_TYPE_OPTIONS } from '@/modules/plugin/utilities/node-types';

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
