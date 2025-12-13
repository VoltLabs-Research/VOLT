import { NodeType } from '@/types/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';

class SchemaHandler implements NodeHandler{
    readonly type = NodeType.SCHEMA;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            definition: T.object({}, 'Schema definition')
        }
    };

    async execute(node: IWorkflowNode): Promise<Record<string, any>>{
        return {
            definition: node.data.schema?.definition || {}
        }
    }
};

export default new SchemaHandler();
