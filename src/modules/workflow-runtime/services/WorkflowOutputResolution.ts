import { logger } from '@/core/logger';
import { isRecord, stringifyUnknown } from '@/shared/utils';
import { WorkflowNodeType, type WorkflowGraph } from '../contracts';

interface WorkflowReferenceResolutionOptions {
    workflow?: WorkflowGraph;
    currentNodeId?: string;
}

const WORKFLOW_REFERENCE_ALIASES: Record<string, WorkflowNodeType[]> = {
    modifier: [WorkflowNodeType.Modifier],
    arguments: [WorkflowNodeType.Arguments],
    context: [WorkflowNodeType.Context],
    foreach: [WorkflowNodeType.ForEach],
    entrypoint: [WorkflowNodeType.Entrypoint],
    plugin: [WorkflowNodeType.Plugin],
    exposure: [WorkflowNodeType.Exposure],
    export: [WorkflowNodeType.Export],
    if: [WorkflowNodeType.IfStatement],
    switch: [WorkflowNodeType.SwitchStatement],
    case: [WorkflowNodeType.SwitchCase]
};

const tokenizeReferencePath = (value: string): string[] => {
    return value
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter(Boolean);
};

const getValueAtPath = (
    value: unknown,
    pathSegments: string[]
): unknown => {
    return pathSegments.reduce<unknown>((currentValue, segment) => {
        if (Array.isArray(currentValue)) {
            const index = Number(segment);
            return Number.isInteger(index)
                ? currentValue[index]
                : undefined;
        }

        if (!isRecord(currentValue)) {
            return undefined;
        }

        return currentValue[segment];
    }, value);
};

const resolveAliasNodeId = (
    alias: string,
    workflow: WorkflowGraph,
    currentNodeId?: string
): string | null => {
    const normalizedAlias = alias.trim().toLowerCase();
    const targetTypes = WORKFLOW_REFERENCE_ALIASES[normalizedAlias];
    if (!targetTypes?.length) {
        return null;
    }

    if (currentNodeId) {
        const currentNode = workflow.nodes.find((node) => node.id === currentNodeId);
        if (currentNode && targetTypes.includes(currentNode.type)) {
            return currentNode.id;
        }

        for (const targetType of targetTypes) {
            const ancestorNode = workflow.findAncestorByType(currentNodeId, targetType);
            if (ancestorNode) {
                return ancestorNode.id;
            }
        }
    }

    const candidates = workflow.topologicalSort()
        .filter((node) => targetTypes.includes(node.type));

    if (candidates.length === 1) {
        return candidates[0].id;
    }

    return candidates[0]?.id ?? null;
};

export const resolveWorkflowOutputReference = (
    ref: string,
    outputs: Map<string, Record<string, unknown>>,
    options: WorkflowReferenceResolutionOptions = {}
): unknown => {
    const parts = tokenizeReferencePath(ref);
    const requestedNodeId = parts[0];
    const propertyPath = parts.slice(1);
    const nodeId = outputs.has(requestedNodeId)
        ? requestedNodeId
        : options.workflow
            ? resolveAliasNodeId(requestedNodeId, options.workflow, options.currentNodeId) ?? requestedNodeId
            : requestedNodeId;
    const nodeOutput = outputs.get(nodeId);

    if (!nodeOutput) {
        logger.warn(`Workflow reference not found for node ${nodeId}`);
        return undefined;
    }

    if (propertyPath.length === 0) {
        return nodeOutput;
    }

    return getValueAtPath(nodeOutput, propertyPath);
};

export const resolveWorkflowTemplate = (
    template: string,
    outputs: Map<string, Record<string, unknown>>,
    options: WorkflowReferenceResolutionOptions = {}
): string => {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref: string) => {
        const value = resolveWorkflowOutputReference(ref.trim(), outputs, options);
        return value !== undefined ? stringifyUnknown(value) : '';
    });
};
