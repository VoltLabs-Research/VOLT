import { injectable, inject } from 'tsyringe';
import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T, INodeRegistry } from '@modules/plugin/domain/ports/INodeRegistry';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export default class ForEachHandler implements INodeHandler{
    readonly type = WorkflowNodeType.ForEach;

    constructor(
        @inject(PLUGIN_TOKENS.NodeRegistry)
        private registry: INodeRegistry
    ){}

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            items: T.array(T.any()),
            count: T.number()
        }
    };

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const rawRef = node.data.forEach?.iterableSource;
        if(!rawRef) throw new Error('ForEachHandler: Missing iterableSource');

        const cleanRef = rawRef.replace(/^\{\{\s*|\s*\}\}$/g, '');
        const items = this.registry.resolveReference(cleanRef, context);

        if(!Array.isArray(items)){
            throw new Error('ForEachHandler: Source is not an array');
        }

        return {
            items,
            count: items.length,
            currentValue: null,
            currentIndex: -1
        };
    }
};