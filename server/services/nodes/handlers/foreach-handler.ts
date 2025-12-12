import { NodeType } from '@/types/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext, resolveReference } from '@services/nodes/node-registry';
import { T, NodeOutputSchema } from '@services/nodes/schema-types';
import logger from '@/logger';

class ForEachHandler implements NodeHandler{
    readonly type = NodeType.FOREACH;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            items: T.array(T.any(), 'All items to iterate'),
            count: T.number('Total item count'),
            currentValue: T.any('Current iteration item'),
            currentIndex: T.number('Current iteration index'),
            outputPath: T.string('Temp output path for current item')
        }
    };

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        let ref = node.data.forEach?.iterableSource;
        if(!ref) throw new Error('ForEach::IterableSource::Required');

        ref = ref.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '');
        const items = resolveReference(ref, context);

        if(Array.isArray(items)){
            logger.error(`[ForEachHandler] Source '${ref}' resolved to non-array: ${typeof items}`);
            throw new Error('ForEach::IterableSource::NotAnArray');
        }
        
        return {
            items,
            count: items.length,
            currentValue: null,
            currentIndex: -1,
            outputPath: null
        };
    }
};

export default new ForEachHandler();