import type { WorkflowArgumentDefinition, WorkflowArgumentVisibilityCondition } from '@shared/contracts/types/http-workflow';
import type { WorkflowNodeOutput, WorkflowValue } from '@shared/contracts/types/workflow.types';

const matchesVisibilityCondition = (
    condition: WorkflowArgumentVisibilityCondition,
    currentValue: WorkflowValue
): boolean => {
    const comparisonValues = condition.values
        ?? (condition.value === undefined ? [] : [condition.value]);
    const contains = (candidate: WorkflowValue): boolean => (
        comparisonValues.includes(candidate as string | number | boolean)
    );

    switch (condition.operator) {
        case 'equals':
            return comparisonValues.length > 0 && currentValue === comparisonValues[0];
        case 'notEquals':
            return comparisonValues.length > 0 && currentValue !== comparisonValues[0];
        case 'in':
            return Array.isArray(currentValue) ? currentValue.some(contains) : contains(currentValue);
        case 'notIn':
            return Array.isArray(currentValue) ? !currentValue.some(contains) : !contains(currentValue);
        default:
            return true;
    }
};

/*
 * Precedence matters: a definition pinned to a literal `value` wins over whatever the run
 * supplied, and an argument the run never mentioned falls back to its declared `default`.
 * That last step is what makes a condition work for an argument the user never touched.
 */
const readConditionSourceValue = (
    argumentKey: string,
    definitions: WorkflowArgumentDefinition[],
    values: WorkflowNodeOutput
): WorkflowValue => {
    const referenced = definitions.find((candidate) => candidate.argument === argumentKey);
    if (referenced?.value !== undefined) {
        return referenced.value;
    }

    if (values[argumentKey] !== undefined) {
        return values[argumentKey];
    }

    return referenced?.default;
};

/**
 * Evaluates a standalone condition against a run's argument values. Used for exposure
 * `exportWhen` gates, which share the operator semantics of argument `visibleWhen` but hang
 * off an exposure node rather than an argument definition.
 */
export const matchesArgumentCondition = (
    condition: WorkflowArgumentVisibilityCondition | undefined,
    definitions: WorkflowArgumentDefinition[],
    values: WorkflowNodeOutput
): boolean => {
    const argumentKey = condition?.argument;
    if (!condition || !argumentKey) {
        return true;
    }

    return matchesVisibilityCondition(condition, readConditionSourceValue(argumentKey, definitions, values));
};

export const isArgumentVisible = (
    definition: WorkflowArgumentDefinition,
    definitions: WorkflowArgumentDefinition[],
    values: WorkflowNodeOutput
): boolean => matchesArgumentCondition(definition.visibleWhen, definitions, values);
