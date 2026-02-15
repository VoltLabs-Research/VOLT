import type { NodeProps } from '@xyflow/react';
import { NodeType, type ISchemaData } from '@/modules/plugin/domain/entities';
import BaseNode from '@/modules/plugin/presentation/components/atoms/BaseNode';

const SchemaNode = (props: NodeProps) => {
    const { data } = props;
    const schema = (data.schema as ISchemaData) || {};
    const fieldCount = Object.keys(schema.definition || {}).length;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.SCHEMA}
            description={`${fieldCount} field(s) registered`}
        />
    );
};

export default SchemaNode;
