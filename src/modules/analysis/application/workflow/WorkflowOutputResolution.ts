import { logger } from '@/core/logger';
import { stringifyUnknown } from '@/support/serialization/serialization';
import { isRecord } from '@/support/type-guards/isRecord';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowGraph, WorkflowNodeOutput, WorkflowValue } from '@/modules/analysis/contracts/workflow.types';

interface WorkflowReferenceResolutionOptions {
    workflow?: WorkflowGraph;
    currentNodeId?: string;
}

type WorkflowOutputs = Map<string, WorkflowNodeOutput>;

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

const resolveAliasNodeId = (
    alias: string,
    workflow: WorkflowGraph,
    currentNodeId?: string
): string | null => {
    const targetTypes = WORKFLOW_REFERENCE_ALIASES[alias.toLowerCase()];
    if (!targetTypes) {
        return null;
    }

    if (currentNodeId) {
        const currentNode = workflow.getNode(currentNodeId);
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

    if (candidates.length === 0) {
        return null;
    }

    return candidates[0].id;
};

export const resolveWorkflowOutputReference = (
    ref: string,
    outputs: WorkflowOutputs,
    options: WorkflowReferenceResolutionOptions = {}
): WorkflowValue => {
    const parts = ref
        .trim()
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .map((part) => part.trim())
        .filter(Boolean);
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

    let value: WorkflowValue = nodeOutput;

    for (const segment of propertyPath) {
        if (Array.isArray(value)) {
            value = value[Number(segment)];
            continue;
        }

        if (!isRecord(value)) {
            return undefined;
        }

        value = value[segment];
    }

    return value;
};

export const resolveWorkflowTemplate = (
    template: string,
    outputs: WorkflowOutputs,
    options: WorkflowReferenceResolutionOptions = {}
): string => {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref: string) => {
        const value = resolveWorkflowOutputReference(ref, outputs, options);
        return value !== undefined ? stringifyUnknown(value) : '';
    });
};
