import type { WorkflowIfCondition } from '@/contracts';
import type { WorkflowExecutionContext, WorkflowNode } from '@/modules/analysis/contracts/workflow.types';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@/modules/analysis/application/workflow';

export class WorkflowIfStatementHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.IfStatement;

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        const conditions = node.data.ifStatement?.conditions ?? [];

        if (conditions.length === 0) {
            return { result: true, branch: 'true' };
        }

        const finalResult = conditions.reduce((acc: boolean, condition: WorkflowIfCondition, index: number) => {
            const left = this.resolveValue(condition.leftExpression ?? '', context, node.id);
            const right = this.resolveValue(condition.rightExpression ?? '', context, node.id);
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

    private resolveValue(expression: string, context: WorkflowExecutionContext, currentNodeId: string): unknown {
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
};
