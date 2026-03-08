import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T, INodeRegistry } from '@modules/plugin/domain/port/plugin/INodeRegistry';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

import { ErrorCodes } from '@core/constants/error-codes';
import { injectable, inject } from 'tsyringe';

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
        if(!rawRef) throw new Error(ErrorCodes.PLUGIN_FOREACH_SOURCE_REQUIRED);

        const cleanRef = rawRef.replace(/^\{\{\s*|\s*\}\}$/g, '');
        const items = this.registry.resolveReference(cleanRef, context);

        if(!Array.isArray(items)){
            throw new Error(ErrorCodes.PLUGIN_FOREACH_SOURCE_INVALID);
        }

        return {
            items,
            count: items.length,
            currentValue: null,
            currentIndex: -1
        };
    }
};
