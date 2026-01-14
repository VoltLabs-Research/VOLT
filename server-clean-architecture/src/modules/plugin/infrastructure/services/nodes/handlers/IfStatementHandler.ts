import { injectable, inject } from 'tsyringe';
import { IfStatementConditionType, IfStatementConditionHandler } from '@/src/modules/plugin/domain/entities/workflow/nodes/IfStatementNode';
import { WorkflowNodeType, WorkflowNode } from '@/src/modules/plugin/domain/entities/workflow/WorkflowNode';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T, INodeRegistry } from '@/src/modules/plugin/domain/ports/INodeRegistry';
import { PLUGIN_TOKENS } from '../../../di/PluginTokens';

@injectable()
export default class IfStatementHandler implements INodeHandler{
    readonly type = WorkflowNodeType.IfStatement;
    
    constructor(
        @inject(PLUGIN_TOKENS.NodeRegistry)
        private registry: INodeRegistry
    ){}

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            result: T.boolean(),
            branch: T.string()
        }
    };

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const conditions = node?.data?.ifStatement?.conditions || [];
        if(!conditions.length){
            return {
                result: true,
                branch: 'true'
            };
        }

        const finalResult = conditions.reduce((accResult, condition, index) => {
            const left = this.resolveValue(condition.leftExpression, context);
            const right = this.resolveValue(condition.rightExpression, context);

            const isMatch = condition.handler === IfStatementConditionHandler.IsEqualTo
                ? left == right
                : left != right;
            
            if(index === 0) return isMatch;

            return condition.type === IfStatementConditionType.And
                ? (accResult && isMatch)
                : (accResult || isMatch);
        }, true);

        return {
            result: finalResult,
            branch: finalResult ? 'true' : 'false'
        };
    }

    private resolveValue(expression: string, context: ExecutionContext): any{
        if(!expression) return '';
        const resolved = this.registry.resolveTemplate(expression, context);

        if(resolved.toLowerCase() === 'true') return true;
        if(resolved.toLowerCase() === 'false') return false;

        const num = Number(resolved);

        return (!isNaN(num) && resolved.trim() !== '') ? num : resolved;
    }
};