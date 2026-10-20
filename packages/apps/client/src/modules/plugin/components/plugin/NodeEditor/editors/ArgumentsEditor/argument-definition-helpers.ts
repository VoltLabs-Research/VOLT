import { ArgumentVisibilityOperator } from '@volt/contracts/modules/plugin/enums';
import type { IArgumentDefinition, IArgumentVisibilityCondition } from '@volt/contracts/modules/plugin/workflow';

export const isMultiValueVisibilityOperator = (
    operator: ArgumentVisibilityOperator
): boolean => {
    return operator === ArgumentVisibilityOperator.IN || operator === ArgumentVisibilityOperator.NOT_IN;
};

export const getArgumentLabel = (argument: IArgumentDefinition): string => {
    return argument.label.trim() || argument.argument.trim();
};

export const formatArgumentInputValue = (value: unknown): string => {
    if (value === undefined || value === null) {
        return '';
    }

    return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

export const getVisibilityValueInput = (condition: IArgumentVisibilityCondition): string => {
    if (isMultiValueVisibilityOperator(condition.operator)) {
        return (condition.values ?? []).map(String).join(', ');
    }

    return condition.value === undefined ? '' : String(condition.value);
};
