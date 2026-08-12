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

export const isArgumentVisible = (
    definition: WorkflowArgumentDefinition,
    definitions: WorkflowArgumentDefinition[],
    values: WorkflowNodeOutput
): boolean => {
    const condition = definition.visibleWhen;
    if (!condition?.argument) {
        return true;
    }

    const referenced = definitions.find((candidate) => candidate.argument === condition.argument);
    let currentValue: WorkflowValue;
    if (referenced?.value !== undefined) {
        currentValue = referenced.value;
    } else if (values[condition.argument] !== undefined) {
        currentValue = values[condition.argument];
    } else {
        currentValue = referenced?.default;
    }

    return matchesVisibilityCondition(condition, currentValue);
};
