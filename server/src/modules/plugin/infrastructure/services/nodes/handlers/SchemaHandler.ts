import { injectable } from 'tsyringe';
import { INodeHandler, NodeOutputSchema, T } from '@modules/plugin/domain/ports/INodeRegistry';
import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

@injectable()
export default class SchemaHandler implements INodeHandler{
    readonly type = WorkflowNodeType.Schema;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            definition: T.object({})
        }
    };

    async execute(node: WorkflowNode): Promise<Record<string, any>>{
        return {
            definition: node.data.schema?.definition || {}
        };
    }
};