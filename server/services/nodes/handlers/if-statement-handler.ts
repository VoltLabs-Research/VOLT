import { NodeType } from '@/types/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext, resolveTemplate } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@services/nodes/schema-types';
import logger from '@/logger';

export enum ConditionType {
    AND = 'and',
    OR = 'or'
}

export enum ConditionHandler {
    IS_EQUAL_TO = 'is_equal_to',
    IS_NOT_EQUAL_TO = 'is_not_equal_to'
}

export interface ICondition {
    type: ConditionType;
    leftExpr: string;
    handler: ConditionHandler;
    rightExpr: string;
}

export interface IIfStatementData {
    conditions: ICondition[];
}

class IfStatementHandler implements NodeHandler {
    readonly type = NodeType.IF_STATEMENT;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            result: T.boolean('Final evaluation result'),
            conditionsEvaluated: T.array(T.object({
                leftValue: T.any('Resolved left expression value'),
                rightValue: T.any('Resolved right expression value'),
                handler: T.string('Comparison operator used'),
                passed: T.boolean('Whether this condition passed')
            }), 'Individual condition evaluation results'),
            branch: T.string('Which branch to execute: "true" or "false"')
        }
    };

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>> {
        const data = node.data.ifStatement as IIfStatementData | undefined;
        const conditions = data?.conditions || [];

        if (conditions.length === 0) {
            logger.warn(`[IfStatementHandler] Node ${node.id} has no conditions, defaulting to true`);
            return { result: true, conditionsEvaluated: [], branch: 'true' };
        }

        const evaluatedConditions: Array<{
            leftValue: any;
            rightValue: any;
            handler: string;
            passed: boolean;
        }> = [];

        let result = true;

        for (let i = 0; i < conditions.length; i++) {
            const condition = conditions[i];
            const leftValue = this.resolveExpression(condition.leftExpr, context);
            const rightValue = this.resolveExpression(condition.rightExpr, context);
            const passed = this.evaluateCondition(leftValue, rightValue, condition.handler);

            evaluatedConditions.push({
                leftValue,
                rightValue,
                handler: condition.handler,
                passed
            });

            if (i === 0) {
                result = passed;
            } else {
                result = condition.type === ConditionType.AND
                    ? result && passed
                    : result || passed;
            }

            logger.debug(`[IfStatementHandler] Condition ${i}: ${leftValue} ${condition.handler} ${rightValue} = ${passed} (cumulative: ${result})`);
        }

        logger.info(`[IfStatementHandler] Node ${node.id} evaluated to ${result}`);

        return {
            result,
            conditionsEvaluated: evaluatedConditions,
            branch: result ? 'true' : 'false'
        };
    }

    private resolveExpression(expr: string, context: ExecutionContext): any {
        if (!expr) return '';
        const resolved = resolveTemplate(expr, context);

        const lower = resolved.toLowerCase().trim();
        if (lower === 'true') return true;
        if (lower === 'false') return false;

        // Try to parse as number if it looks numeric
        const num = Number(resolved);
        return !isNaN(num) && resolved.trim() !== '' ? num : resolved;
    }

    private evaluateCondition(left: any, right: any, handler: ConditionHandler): boolean {
        switch (handler) {
            case ConditionHandler.IS_EQUAL_TO:
                return left == right; // Loose equality for flexibility
            case ConditionHandler.IS_NOT_EQUAL_TO:
                return left != right;
            default:
                logger.warn(`[IfStatementHandler] Unknown handler: ${handler}, defaulting to false`);
                return false;
        }
    }
}

export default new IfStatementHandler();