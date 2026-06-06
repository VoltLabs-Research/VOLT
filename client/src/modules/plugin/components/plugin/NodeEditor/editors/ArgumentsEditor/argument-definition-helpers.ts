import { ArgumentVisibilityOperator } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { IArgumentDefinition, IArgumentVisibilityCondition } from '@/modules/plugin/api/entities/plugin/workflow';

export const isMultiValueVisibilityOperator = (
    operator?: ArgumentVisibilityOperator
): boolean => {
    return operator === ArgumentVisibilityOperator.IN || operator === ArgumentVisibilityOperator.NOT_IN;
};

export const getArgumentLabel = (argument: IArgumentDefinition): string => {
    return argument.label?.trim() || argument.argument?.trim() || '';
};

export const getArgumentFieldInputValue = (
    argument: IArgumentDefinition,
    field: 'default' | 'value'
): string => {
    const fieldValue = argument[field];
    if (fieldValue === undefined || fieldValue === null) {
        return '';
    }

    if (typeof fieldValue === 'string') {
        return fieldValue;
    }

    if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') {
        return String(fieldValue);
    }

    try {
        return JSON.stringify(fieldValue);
    } catch {
        return '';
    }
};

export const getVisibilityValueInput = (condition?: IArgumentVisibilityCondition): string => {
    if (!condition) {
        return '';
    }

    if (isMultiValueVisibilityOperator(condition.operator)) {
        return (condition.values ?? []).map(String).join(', ');
    }

    if (condition.value === undefined) {
        return '';
    }

    return String(condition.value);
};

export const formatValueMapInput = (valueMap?: Record<string, unknown>): string => {
    if (!valueMap) {
        return '';
    }

    try {
        return JSON.stringify(valueMap);
    } catch {
        return '';
    }
};

export const parseValueMapInput = (rawValue: string): Record<string, unknown> | undefined => {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
        return undefined;
    }

    try {
        const parsedValue = JSON.parse(trimmedValue) as unknown;
        if (typeof parsedValue === 'object' && parsedValue !== null && !Array.isArray(parsedValue)) {
            return parsedValue as Record<string, unknown>;
        }
    } catch {
        return undefined;
    }

    return undefined;
};
