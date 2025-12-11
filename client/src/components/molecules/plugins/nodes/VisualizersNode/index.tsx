import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';
import NodeField from '@/components/atoms/plugins/NodeField';

const VisualizersNode = memo((props: NodeProps) => {
    const { data } = props;
    const visualizers = data.visualizers || {};
    const listingCount = Object.keys(visualizers.listing || {}).length;

    const enabledVisualizers = [
        visualizers.canvas && 'Canvas',
        visualizers.raster && 'Raster'
    ].filter(Boolean).join(', ') || 'None';

    return (
        <BaseNode {...props} nodeType={NodeType.VISUALIZERS}>
            <NodeField label='Enabled' value={enabledVisualizers} />
            <NodeField label='Listing Columns' value={`${listingCount} columns`} />
        </BaseNode>
    );
});

export default VisualizersNode;
