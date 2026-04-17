import jsonata from 'jsonata';

import type { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
import { resolveWorkflowTemplate } from '@/modules/analysis/application/workflow/WorkflowOutputResolution';
import type { WorkflowExecutionContext, WorkflowValue } from '@/modules/analysis/contracts/workflow.types';
import { stringifyUnknown } from '@/support/serialization/serialization';

const buildWorkflowExpressionScope = (
    context: WorkflowExecutionContext,
    currentNodeId?: string
): Record<string, unknown> => {
    return {
        analysis: context.analysis,
        analysisId: context.analysisId,
        currentNodeId,
        generatedFiles: context.generatedFiles,
        nestedWorkflows: Object.fromEntries(context.nestedWorkflows.entries()),
        outputs: Object.fromEntries(context.outputs.entries()),
        pluginId: context.pluginId,
        runtimeArguments: context.runtimeArguments,
        selectedFrameOnly: context.selectedFrameOnly,
        selectedTimestep: context.selectedTimestep,
        selectedTimesteps: context.selectedTimesteps,
        teamId: context.teamId,
        trajectoryDumpOverrides: context.trajectoryDumpOverrides,
        trajectoryFrames: context.trajectoryFrames,
        trajectoryId: context.trajectoryId,
        userConfig: context.userConfig
    };
};

const resolveWorkflowExpression = async (
    expression: string | undefined,
    registry: WorkflowNodeRegistry,
    context: WorkflowExecutionContext,
    currentNodeId?: string
): Promise<WorkflowValue> => {
    if (!expression) {
        return '';
    }

    if (expression.startsWith('=')) {
        return await jsonata(expression.slice(1)).evaluate(
            buildWorkflowExpressionScope(context, currentNodeId)
        ) as WorkflowValue;
    }

    return expression.includes('{{')
        ? registry.resolveTemplate(expression, context, currentNodeId)
        : expression;
};

export const shouldResolveWorkflowExpression = (value: WorkflowValue): value is string => {
    return typeof value === 'string'
        && (value.startsWith('=') || value.includes('{{'));
};

export const resolveWorkflowExpressionValue = (
    expression: string | undefined,
    registry: WorkflowNodeRegistry,
    context: WorkflowExecutionContext,
    currentNodeId?: string
): Promise<WorkflowValue> => {
    return resolveWorkflowExpression(expression, registry, context, currentNodeId);
};

export const resolveWorkflowComparableValue = (
    expression: string | undefined,
    registry: WorkflowNodeRegistry,
    context: WorkflowExecutionContext,
    currentNodeId?: string
): Promise<boolean | number | string> => {
    return resolveWorkflowExpression(expression, registry, context, currentNodeId)
        .then((resolved) => {
            if (typeof resolved === 'boolean' || typeof resolved === 'number') {
                return resolved;
            }

            const normalized = stringifyUnknown(resolved);
            if (normalized.toLowerCase() === 'true') {
                return true;
            }

            if (normalized.toLowerCase() === 'false') {
                return false;
            }

            const numeric = Number(normalized);
            return !Number.isNaN(numeric) && normalized.trim() !== ''
                ? numeric
                : normalized;
        });
};

export const resolveWorkflowComparableString = (
    expression: string | undefined,
    registry: WorkflowNodeRegistry,
    context: WorkflowExecutionContext,
    currentNodeId?: string
): Promise<string> => {
    return resolveWorkflowExpression(expression, registry, context, currentNodeId)
        .then((resolved) => stringifyUnknown(resolved));
};

export { resolveWorkflowTemplate };
