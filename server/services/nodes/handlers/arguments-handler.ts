import { NodeType } from '@/types/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';

class ArgumentsHandler implements NodeHandler{
    readonly type = NodeType.ARGUMENTS;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            as_str: T.string('All arguments as single string'),
            as_array: T.array(T.string(), 'Arguments as array')
        }
    };

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const argDefs = node.data.arguments?.arguments || [];
        const argsArray: string[] = [];
        const values: Record<string, any> = {};

        for(const argDef of argDefs){
            // value > userConfig > default
            const value = argDef.value ?? context.userConfig[argDef.argument] ?? argDef.default;
            values[argDef.argument] = value;
            if(value === undefined || value === null) continue;

            if(argDef.type === 'boolean'){
                if(value === true || value === 'true') argsArray.push(`--${argDef.argument}`);
            }else{
                argsArray.push(`--${argDef.argument}`, String(value));
            }
        }

        return {
            as_str: argsArray.join(' '),
            as_array: argsArray,
                ...values
        };
    }
};

export default new ArgumentsHandler();
