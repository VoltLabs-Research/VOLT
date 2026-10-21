import type { WorkflowExecutionContext, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@modules/analysis/services/workflow/NodeRegistry';
import { NodeType, ConditionHandler, ConditionType } from '@volt/contracts/modules/plugin/enums';
import type { ICondition, IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';

interface WorkflowIfStatementOutput extends WorkflowNodeOutput {
    result: boolean;
    branch: 'true' | 'false';
}

export class WorkflowIfStatementHandler implements WorkflowNodeHandler {
    readonly type = NodeType.IF_STATEMENT;
    private static readonly INITIAL_CONDITION_RESULT = true;

    constructor(private readonly registry: WorkflowNodeRegistry){}

    async execute(node: IWorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowIfStatementOutput> {
        const ifStatement = node.data.ifStatement;
        const conditions = ifStatement?.conditions ?? [];

        if (conditions.length === 0) {
            return {
                result: true,
                branch: 'true'
            };
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
        condition: ICondition,
        index: number,
        context: WorkflowExecutionContext,
        nodeId: string
    ): Promise<boolean> {
        const [left, right] = await Promise.all([
            this.registry.createValueResolver(context, nodeId).resolveExpressionValue(condition.leftExpr ?? ''),
            this.registry.createValueResolver(context, nodeId).resolveExpressionValue(condition.rightExpr ?? '')
        ]);

        const isMatch = condition.handler === ConditionHandler.IS_EQUAL_TO
            ? left == right
            : left != right;

        if (index === 0 || currentResult === undefined) {
            return isMatch;
        }

        return condition.type === ConditionType.AND ? (currentResult && isMatch) : (currentResult || isMatch);
    }
};
