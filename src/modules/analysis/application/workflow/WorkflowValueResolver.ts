import jsonata from 'jsonata';

import { logger } from '@/core/logger';
import type {
    WorkflowExecutionContext,
    WorkflowGraph,
    WorkflowNodeOutput,
    WorkflowNodeType,
    WorkflowValue
} from '@/modules/analysis/contracts/workflow.types';
import { WorkflowNodeType as WorkflowNodeTypeEnum } from '@/modules/analysis/contracts/workflow.types';
import { stringifyUnknown } from '@/support/serialization/serialization';
import { isRecord } from '@/support/type-guards/is-record';

interface WorkflowValueResolverOptions {
    outputs: Map<string, WorkflowNodeOutput>;
    workflow?: WorkflowGraph;
    context?: WorkflowExecutionContext;
    currentNodeId?: string;
}

const WORKFLOW_REFERENCE_ALIASES: Record<string, WorkflowNodeType[]> = {
    modifier: [WorkflowNodeTypeEnum.Modifier],
    arguments: [WorkflowNodeTypeEnum.Arguments],
    context: [WorkflowNodeTypeEnum.Context],
    foreach: [WorkflowNodeTypeEnum.ForEach],
    entrypoint: [WorkflowNodeTypeEnum.Entrypoint],
    plugin: [WorkflowNodeTypeEnum.Plugin],
    exposure: [WorkflowNodeTypeEnum.Exposure],
    export: [WorkflowNodeTypeEnum.Export],
    if: [WorkflowNodeTypeEnum.IfStatement],
    switch: [WorkflowNodeTypeEnum.SwitchStatement],
    case: [WorkflowNodeTypeEnum.SwitchCase]
};

export class WorkflowValueResolver {
    constructor(private readonly options: WorkflowValueResolverOptions) {}

    static shouldResolveExpression(value: WorkflowValue): value is string {
        return typeof value === 'string'
            && (value.startsWith('=') || value.includes('{{'));
    }

    resolveReference(ref: string): WorkflowValue {
        const parts = ref
            .trim()
            .replace(/\[(\d+)\]/g, '.$1')
            .split('.')
            .map((part) => part.trim())
            .filter(Boolean);
        const requestedNodeId = parts[0];
        const propertyPath = parts.slice(1);
        const nodeId = this.options.outputs.has(requestedNodeId)
            ? requestedNodeId
            : this.options.workflow
                ? this.resolveAliasNodeId(requestedNodeId) ?? requestedNodeId
                : requestedNodeId;
        const nodeOutput = this.options.outputs.get(nodeId);

        if (!nodeOutput) {
            logger.warn(`Workflow reference not found for node ${nodeId}`);
            return undefined;
        }

        if (propertyPath.length === 0) {
            return nodeOutput;
        }

        let value: WorkflowValue = nodeOutput;

        for (const segment of propertyPath) {
            if (Array.isArray(value)) {
                value = value[Number(segment)];
                continue;
            }

            if (!isRecord(value)) {
                return undefined;
            }

            value = value[segment] as WorkflowValue;
        }

        return value;
    }

    resolveTemplate(template: string): string {
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref: string) => {
            const value = this.resolveReference(ref);
            return value !== undefined
                ? stringifyUnknown(value as Parameters<typeof stringifyUnknown>[0])
                : '';
        });
    }

    resolveExpressionValue(expression: string): Promise<WorkflowValue> {
        return this.resolveExpression(expression);
    }

    async resolveComparableString(expression: string): Promise<string> {
        const resolved = await this.resolveExpression(expression);
        return stringifyUnknown(resolved as Parameters<typeof stringifyUnknown>[0]);
    }

    private resolveAliasNodeId(alias: string): string | null {
        const workflow = this.options.workflow;
        if (!workflow) {
            return null;
        }

        const targetTypes = WORKFLOW_REFERENCE_ALIASES[alias.toLowerCase()];
        if (!targetTypes) {
            return null;
        }

        if (this.options.currentNodeId) {
            const currentNode = workflow.getNode(this.options.currentNodeId);
            if (currentNode && targetTypes.includes(currentNode.type)) {
                return currentNode.id;
            }

            for (const targetType of targetTypes) {
                const ancestorNode = workflow.findAncestorByType(this.options.currentNodeId, targetType);
                if (ancestorNode) {
                    return ancestorNode.id;
                }
            }
        }

        const candidates = workflow.topologicalSort()
            .filter((node) => targetTypes.includes(node.type));

        return candidates[0]?.id ?? null;
    }

    private async resolveExpression(expression: string): Promise<WorkflowValue> {
        if (expression.startsWith('=')) {
            if (!this.options.context) {
                throw new Error('Workflow expression resolution requires an execution context');
            }

            return await jsonata(expression.slice(1)).evaluate(
                this.buildExpressionScope(this.options.context)
            ) as WorkflowValue;
        }

        return expression.includes('{{')
            ? this.resolveTemplate(expression)
            : expression;
    }

    private buildExpressionScope(
        context: WorkflowExecutionContext
    ): Record<string, unknown> {
        const {
            workflow: _workflow,
            nestedWorkflows,
            outputs,
            ...scope
        } = context;

        return {
            ...scope,
            currentNodeId: this.options.currentNodeId,
            nestedWorkflows: Object.fromEntries(nestedWorkflows),
            outputs: Object.fromEntries(outputs)
        };
    }
}
