import { memo, useEffect } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';
import { EXPORT_TYPE_OPTIONS } from '@/utilities/plugins/node-types';

const ExportNode = memo((props: NodeProps) => {
    const { data } = props;
    const exportData = data.export || {};

    return(
        <BaseNode 
            {...props} 
            nodeType={NodeType.EXPORT} 
            nodeTitle={exportData.exporter}
            description={exportData.type ? `${EXPORT_TYPE_OPTIONS.find((v) => v.value === exportData.type).label}` : 'Configuration needed'}
        />
    );
});

export default ExportNode;
