import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import BaseNode from '@/components/atoms/plugins/BaseNode';

const SchemaNode = memo((props: NodeProps) => {
    const { data } = props;
    const schema = data.schema || {};
    const fieldCount = Object.keys(schema.definition || {}).length;

    return(
        <BaseNode
            {...props}
            nodeType={NodeType.SCHEMA}
            description={`${fieldCount} field(s) registered`}
        />
    );
});

export default SchemaNode;
