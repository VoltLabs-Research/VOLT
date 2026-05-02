import type { WorkflowIfCondition } from '@/contracts';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

interface WorkflowIfStatementOutput extends WorkflowNodeOutput {
    result: boolean;
    branch: 'true' | 'false';
}

export class WorkflowIfStatementHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.IfStatement;
    private static readonly INITIAL_CONDITION_RESULT = true;

    constructor(private readonly registry: WorkflowNodeRegistry){}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowIfStatementOutput> {
        const ifStatement = node.data.ifStatement;
        const conditions = ifStatement?.conditions ?? [];

        if (conditions.length === 0) {
            return { result: true, branch: 'true' };
        }

        let finalResult = WorkflowIfStatementHandler.INITIAL_CONDITION_RESULT;
        for (const [index, condition] of conditions.entries()) {
            finalResult = await this.reduceConditionResult(
                index === 0 ? undefined : finalResult,
                condition,
                index,
                context,
                node.id
            );
        }

        return {
            result: finalResult,
            branch: finalResult ? 'true' : 'false'
        };
    }

    private async reduceConditionResult(
        currentResult: boolean | undefined,
        condition: WorkflowIfCondition,
        index: number,
        context: WorkflowExecutionContext,
        nodeId: string
    ): Promise<boolean> {
        const [left, right] = await Promise.all([
            this.registry.resolveExpressionValue(condition.leftExpression ?? '', context, nodeId),
            this.registry.resolveExpressionValue(condition.rightExpression ?? '', context, nodeId)
        ]);

        const isMatch = condition.handler === 'is_equal_to'
            ? left == right
            : left != right;

        if (index === 0 || currentResult === undefined) {
            return isMatch;
        }

        return condition.type === 'and' ? (currentResult && isMatch) : (currentResult || isMatch);
    }
};
