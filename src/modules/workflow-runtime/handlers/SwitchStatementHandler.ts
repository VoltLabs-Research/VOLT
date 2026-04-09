import { stringifyUnknown } from '@/shared/utils';
import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';
import { WorkflowNodeType } from '../contracts';
import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '../services';

interface SwitchStatementNodeData {
    expression?: string;
}

interface SwitchCaseNodeData {
    value?: string;
    defaultCase?: boolean;
}

const readSwitchStatementData = (node: WorkflowNode): SwitchStatementNodeData => {
    const record = node.data.switchStatement;
    return typeof record === 'object' && record !== null
        ? record as SwitchStatementNodeData
        : {};
};

const readSwitchCaseData = (node: WorkflowNode): SwitchCaseNodeData => {
    const record = node.data.switchCase;
    return typeof record === 'object' && record !== null
        ? record as SwitchCaseNodeData
        : {};
};

export class WorkflowSwitchStatementHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.SwitchStatement;
    readonly outputSchema = { properties: {} };

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<Record<string, unknown>> {
        const switchStatementData = readSwitchStatementData(node);
        const expression = typeof switchStatementData.expression === 'string'
            ? switchStatementData.expression
            : '';
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
            const caseData = readSwitchCaseData(caseNode);
            if (caseData.defaultCase) {
                defaultCaseId = caseNode.id;
                continue;
            }

            const caseValue = typeof caseData.value === 'string'
                ? caseData.value
                : '';
            if (caseValue === normalizedResolvedValue) {
                matchedCaseId = caseNode.id;
                matchedValue = caseValue;
                break;
            }
        }

        if (!matchedCaseId && defaultCaseId) {
            matchedCaseId = defaultCaseId;
            const defaultCaseNode = caseNodes.find((candidate) => candidate.id === defaultCaseId);
            const defaultCaseData = defaultCaseNode ? readSwitchCaseData(defaultCaseNode) : {};
            matchedValue = typeof defaultCaseData.value === 'string'
                ? defaultCaseData.value
                : null;
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
    readonly outputSchema = { properties: {} };

    async execute(node: WorkflowNode): Promise<Record<string, unknown>> {
        const switchCaseData = readSwitchCaseData(node);

        return {
            value: typeof switchCaseData.value === 'string' ? switchCaseData.value : '',
            defaultCase: Boolean(switchCaseData.defaultCase)
        };
    }
}
