import { stringifyUnknown } from '@/support/serialization/serialization';
import type { WorkflowExecutionContext, WorkflowNode } from '@/modules/analysis/contracts/workflow.types';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@/modules/analysis/application/workflow';

export class WorkflowSwitchStatementHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.SwitchStatement;

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        const expression = node.data.switchStatement?.expression ?? '';
        const resolvedValue = expression.includes('{{')
            ? this.registry.resolveTemplate(expression, context, node.id)
            : expression;
        const normalizedResolvedValue = stringifyUnknown(resolvedValue);
        const caseNodes = context.workflow.edges
            .filter((edge) => edge.source === node.id && edge.sourceHandle === 'cases')
            .map((edge) => context.workflow.nodes.find((candidate) => candidate.id === edge.target))
            .filter((candidate): candidate is WorkflowNode => candidate?.type === WorkflowNodeType.SwitchCase);

        let matchedCaseId: string | null = null;
        let matchedValue: string | null = null;
        let defaultCaseId: string | null = null;

        for (const caseNode of caseNodes) {
            const caseData = caseNode.data.switchCase;
            if (caseData?.defaultCase) {
                defaultCaseId = caseNode.id;
                continue;
            }

            const caseValue = caseData?.value ?? '';
            if (caseValue === normalizedResolvedValue) {
                matchedCaseId = caseNode.id;
                matchedValue = caseValue;
                break;
            }
        }

        if (!matchedCaseId && defaultCaseId) {
            matchedCaseId = defaultCaseId;
            const defaultCaseNode = caseNodes.find((candidate) => candidate.id === defaultCaseId);
            matchedValue = defaultCaseNode?.data.switchCase?.value ?? null;
        }

        return {
            expression,
            resolvedValue: normalizedResolvedValue,
            matchedCaseId,
            matchedValue
        };
    }
}

export class WorkflowSwitchCaseHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.SwitchCase;

    async execute(node: WorkflowNode): Promise<Record<string, unknown>> {
        const switchCaseData = node.data.switchCase;

        return {
            value: switchCaseData?.value ?? '',
            defaultCase: switchCaseData?.defaultCase === true
        };
    }
};
