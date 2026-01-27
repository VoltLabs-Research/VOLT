import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import BaseNode from '@/modules/plugins/presentation/components/atoms/BaseNode';

const SchemaNode = memo((props: NodeProps) => {
    const { data } = props;
    const schema = (data as any).schema || {};
    const fieldCount = Object.keys(schema.definition || {}).length;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.SCHEMA}
            description={`${fieldCount} field(s) registered`}
        />
    );
});

SchemaNode.displayName = 'SchemaNode';

export default SchemaNode;
