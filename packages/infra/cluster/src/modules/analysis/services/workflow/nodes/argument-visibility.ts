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
