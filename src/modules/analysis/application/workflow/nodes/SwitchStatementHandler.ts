import type { WorkflowExecutionContext, WorkflowNode } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowSwitchCaseData, WorkflowSwitchStatementData } from '@/modules/analysis/contracts/http.workflow';
import { resolveWorkflowComparableString } from '@/modules/analysis/application/workflow/WorkflowExpressionResolution';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

interface SwitchStatementOutput {
    expression?: string;
    resolvedValue: string;
    matchedCaseId?: string;
    matchedValue?: string;
}

interface SwitchCaseOutput {
    value?: string;
    defaultCase: boolean;
}

export class WorkflowSwitchStatementHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.SwitchStatement;

    constructor(private readonly registry: WorkflowNodeRegistry) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<SwitchStatementOutput> {
        const switchStatement = node.data.switchStatement as WorkflowSwitchStatementData | undefined;
        const expression = switchStatement?.expression;
        const normalizedResolvedValue = await resolveWorkflowComparableString(
            expression,
            this.registry,
            context,
            node.id
        );
        const caseNodes = context.workflow.getChildren(node.id, 'cases')
            .filter((candidate): candidate is WorkflowNode => candidate.type === WorkflowNodeType.SwitchCase);

        let matchedCaseId: string | undefined;
        let matchedValue: string | undefined;
        let defaultCaseId: string | undefined;

        for (const caseNode of caseNodes) {
            const caseData = caseNode.data.switchCase as WorkflowSwitchCaseData | undefined;
            if (caseData?.defaultCase === true) {
                defaultCaseId = caseNode.id;
                continue;
            }

            const caseValue = caseData?.value;
            if (caseValue === normalizedResolvedValue) {
                matchedCaseId = caseNode.id;
                matchedValue = caseValue;
                break;
            }
        }

        if (!matchedCaseId && defaultCaseId) {
            matchedCaseId = defaultCaseId;
            const defaultCaseNode = caseNodes.find((candidate) => candidate.id === defaultCaseId);
            if (defaultCaseNode) {
                matchedValue = (defaultCaseNode.data.switchCase as WorkflowSwitchCaseData).value;
            }
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

    execute(node: WorkflowNode): Promise<SwitchCaseOutput> {
        const switchCaseData = node.data.switchCase as WorkflowSwitchCaseData;
        const value = switchCaseData.value;
        const defaultCase = switchCaseData.defaultCase === true;

        return Promise.resolve({
            value,
            defaultCase
        });
    }
};
