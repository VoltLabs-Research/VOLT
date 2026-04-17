import type { WorkflowIfCondition } from '@/contracts';
import type { WorkflowExecutionContext, WorkflowNode, WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import { resolveWorkflowComparableValue } from '@/modules/analysis/application/workflow/WorkflowExpressionResolution';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

interface WorkflowIfStatementOutput extends WorkflowNodeOutput {
    result: boolean;
    branch: 'true' | 'false';
}

const INITIAL_CONDITION_RESULT = true;

const reduceConditionResult = (
    currentResult: boolean | undefined,
    condition: WorkflowIfCondition,
    index: number,
    registry: WorkflowNodeRegistry,
    context: WorkflowExecutionContext,
    nodeId: string
): Promise<boolean> => {
    return Promise.all([
        resolveWorkflowComparableValue(condition.leftExpression, registry, context, nodeId),
        resolveWorkflowComparableValue(condition.rightExpression, registry, context, nodeId)
    ]).then(([left, right]) => {
        const isMatch = condition.handler === 'is_equal_to'
            ? left == right
            : left != right;

        if (index === 0 || currentResult === undefined) {
            return isMatch;
        }

        return condition.type === 'and' ? (currentResult && isMatch) : (currentResult || isMatch);
    });
};

export class WorkflowIfStatementHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.IfStatement;

    constructor(private readonly registry: WorkflowNodeRegistry) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<WorkflowIfStatementOutput> {
        const ifStatement = node.data.ifStatement;
        const conditions = ifStatement ? ifStatement.conditions : [];

        if (conditions.length === 0) {
            return Promise.resolve({ result: true, branch: 'true' });
        }

        let finalResult = INITIAL_CONDITION_RESULT;
        for (const [index, condition] of conditions.entries()) {
            finalResult = await reduceConditionResult(
                index === 0 ? undefined : finalResult,
                condition,
                index,
                this.registry,
                context,
                node.id
            );
        }

        return {
            result: finalResult,
            branch: finalResult ? 'true' : 'false'
        };
    }
};
