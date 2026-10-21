import type { WorkflowExecutionContext } from '@shared/contracts/types/workflow.types';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '@modules/analysis/services/workflow/NodeRegistry';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { ISwitchCaseData, ISwitchStatementData, IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';

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
    readonly type = NodeType.SWITCH_STATEMENT;

    constructor(private readonly registry: WorkflowNodeRegistry) {}

    async execute(node: IWorkflowNode, context: WorkflowExecutionContext): Promise<SwitchStatementOutput> {
        const switchStatement = node.data.switchStatement as ISwitchStatementData | undefined;
        const expression = switchStatement?.expression;
        const normalizedResolvedValue = expression
            ? await this.registry.createValueResolver(context, node.id).resolveComparableString(expression)
            : '';
        const caseNodes = context.workflow.getChildren(node.id, 'cases')
            .filter((candidate): candidate is IWorkflowNode => candidate.type === NodeType.SWITCH_CASE);

        let matchedCaseId: string | undefined;
        let matchedValue: string | undefined;
        let defaultCaseId: string | undefined;

        for (const caseNode of caseNodes) {
            const caseData = caseNode.data.switchCase as ISwitchCaseData | undefined;
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
                matchedValue = (defaultCaseNode.data.switchCase as ISwitchCaseData).value;
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
    readonly type = NodeType.SWITCH_CASE;

    execute(node: IWorkflowNode): Promise<SwitchCaseOutput> {
        const switchCaseData = node.data.switchCase as ISwitchCaseData;
        const value = switchCaseData.value;
        const defaultCase = switchCaseData.defaultCase === true;

        return Promise.resolve({
            value,
            defaultCase
        });
    }
};
