import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '../services';
import { WorkflowNodeType } from '../contracts';

export class WorkflowIfStatementHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.IfStatement;
    readonly outputSchema = { properties: {} };

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: any, context: any): Promise<Record<string, unknown>> {
        const conditions = Array.isArray(node.data.ifStatement?.conditions)
            ? node.data.ifStatement.conditions
            : [];

        if (conditions.length === 0) {
            return { result: true, branch: 'true' };
        }

        const finalResult = conditions.reduce((acc: boolean, condition: any, index: number) => {
            const left = this.resolveValue(condition.leftExpression, context, node.id);
            const right = this.resolveValue(condition.rightExpression, context, node.id);
            const isMatch = condition.handler === 'is_equal_to'
                ? left == right
                : left != right;

            if (index === 0) {
                return isMatch;
            }

            return condition.type === 'and' ? (acc && isMatch) : (acc || isMatch);
        }, true);

        return {
            result: finalResult,
            branch: finalResult ? 'true' : 'false'
        };
    }

    private resolveValue(expression: string, context: any, currentNodeId: string): unknown {
        if (!expression) {
            return '';
        }

        const resolved = this.registry.resolveTemplate(expression, context, currentNodeId);
        if (resolved.toLowerCase() === 'true') {
            return true;
        }
        if (resolved.toLowerCase() === 'false') {
            return false;
        }

        const numeric = Number(resolved);
        return !Number.isNaN(numeric) && resolved.trim() !== '' ? numeric : resolved;
    }
}
