import { isRecord } from '@/shared/utils';
import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';
import { WorkflowNodeType } from '../contracts';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '../services';

interface WorkflowIfCondition {
    leftExpression?: string;
    rightExpression?: string;
    handler?: string;
    type?: string;
};

interface WorkflowIfStatementData {
    conditions?: WorkflowIfCondition[];
};

const readIfStatementData = (node: WorkflowNode): WorkflowIfStatementData => {
    if (!isRecord(node.data.ifStatement)) {
        return {};
    }

    const conditions = Array.isArray(node.data.ifStatement.conditions)
        ? node.data.ifStatement.conditions.filter(isRecord).map((condition) => ({
            leftExpression: typeof condition.leftExpression === 'string' ? condition.leftExpression : undefined,
            rightExpression: typeof condition.rightExpression === 'string' ? condition.rightExpression : undefined,
            handler: typeof condition.handler === 'string' ? condition.handler : undefined,
            type: typeof condition.type === 'string' ? condition.type : undefined
        }))
        : undefined;

    return { conditions };
};

export class WorkflowIfStatementHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.IfStatement;
    readonly outputSchema = { properties: {} };

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        const ifStatementData = readIfStatementData(node);
        const conditions = Array.isArray(ifStatementData.conditions)
            ? ifStatementData.conditions
            : [];

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
