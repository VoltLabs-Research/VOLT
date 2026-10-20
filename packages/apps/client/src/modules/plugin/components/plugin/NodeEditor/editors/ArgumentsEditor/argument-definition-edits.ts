import { ArgumentType } from '@volt/contracts/modules/plugin/enums';
import { isPluginReferenceArgumentType } from '@/modules/plugin/utils/plugin/argument-values';
import { isMultiValueVisibilityOperator } from './argument-definition-helpers';
import type { ArgumentVisibilityOperator } from '@volt/contracts/modules/plugin/enums';
import type {
    IArgumentDefinition,
    IArgumentOption,
    IArgumentVisibilityCondition
} from '@volt/contracts/modules/plugin/workflow';

type VisibilityValue = string | number | boolean;

const applyArgumentTypeEdit = (
    argument: IArgumentDefinition,
    nextType: ArgumentType
): IArgumentDefinition => {
    const nextArgument: IArgumentDefinition = {
        ...argument,
        type: nextType
    };
    const isPluginReference = isPluginReferenceArgumentType(nextType);

    if (nextType !== ArgumentType.SELECT) {
        delete nextArgument.options;
        if (!isPluginReference) {
            delete nextArgument.multipleSelection;
        }
    }

    if (nextType !== ArgumentType.NUMBER) {
        delete nextArgument.min;
        delete nextArgument.max;
        delete nextArgument.step;
    }

    if (nextType === ArgumentType.LIST || nextType === ArgumentType.TUPLE) {
        nextArgument.listArguments ??= [];
    } else {
        delete nextArgument.listArguments;
        if (Array.isArray(nextArgument.default)) {
            delete nextArgument.default;
        }
        if (Array.isArray(nextArgument.value)) {
            delete nextArgument.value;
        }
    }

    if (isPluginReference) {
        delete nextArgument.value;
    } else {
        delete nextArgument.pluginReferenceFilter;
        delete nextArgument.pluginReferenceFilterKeys;
        delete nextArgument.showPluginConfiguration;
        delete nextArgument.pluginReferenceMappings;
    }

    return nextArgument;
};

const parseScalarArgumentValue = (type: ArgumentType, rawValue: string): unknown => {
    if (rawValue === '') {
        return undefined;
    }

    if (type === ArgumentType.BOOLEAN) {
        return rawValue === 'true';
    }

    return type === ArgumentType.NUMBER ? Number(rawValue) : rawValue;
};

export const applyArgumentFieldEdit = (
    argument: IArgumentDefinition,
    field: keyof IArgumentDefinition,
    rawValue: string
): IArgumentDefinition => {
    if (field === 'type') {
        return applyArgumentTypeEdit(argument, rawValue as ArgumentType);
    }

    if (field === 'min' || field === 'max' || field === 'step') {
        return {
            ...argument,
            [field]: rawValue === '' ? undefined : Number(rawValue)
        };
    }

    if (field === 'multipleSelection' || field === 'showPluginConfiguration' || field === 'required' || field === 'inferFromContext') {
        const nextArgument: IArgumentDefinition = {
            ...argument,
            [field]: rawValue === 'true'
        };

        if (field === 'inferFromContext' && rawValue === 'true') {
            delete nextArgument.value;
            delete nextArgument.default;
        }

        return nextArgument;
    }

    if (field === 'default' || field === 'value') {
        return {
            ...argument,
            [field]: parseScalarArgumentValue(argument.type, rawValue)
        };
    }

    return {
        ...argument,
        [field]: rawValue
    };
};

export const applyArgumentOptionsEdit = (
    argument: IArgumentDefinition,
    nextOptions: IArgumentOption[]
): IArgumentDefinition => {
    const nextArgument: IArgumentDefinition = {
        ...argument,
        options: nextOptions
    };

    const defaultValue = argument.default;
    if (typeof defaultValue === 'string' && !nextOptions.some((option) => option.key === defaultValue)) {
        delete nextArgument.default;
    }

    return nextArgument;
};

export const applyVisibilityOperatorEdit = (
    condition: IArgumentVisibilityCondition,
    operator: ArgumentVisibilityOperator
): IArgumentVisibilityCondition => {
    const nextCondition: IArgumentVisibilityCondition = {
        argument: condition.argument,
        operator
    };

    if (!isMultiValueVisibilityOperator(operator)) {
        const value = condition.value ?? condition.values?.[0];
        if (value !== undefined) {
            nextCondition.value = value;
        }

        return nextCondition;
    }

    if (condition.values?.length) {
        nextCondition.values = condition.values;
    } else if (condition.value !== undefined) {
        nextCondition.values = [condition.value];
    }

    return nextCondition;
};

const parseVisibilityValue = (rawEntry: string, referenceType?: ArgumentType): VisibilityValue | undefined => {
    const trimmedEntry = rawEntry.trim();
    if (!trimmedEntry) {
        return undefined;
    }

    if (referenceType === ArgumentType.NUMBER) {
        const parsedEntry = Number(trimmedEntry);
        return Number.isFinite(parsedEntry) ? parsedEntry : undefined;
    }

    if (referenceType === ArgumentType.BOOLEAN) {
        return trimmedEntry === 'true';
    }

    return trimmedEntry;
};

export const applyVisibilityValueEdit = (
    condition: IArgumentVisibilityCondition,
    rawValue: string,
    referenceType?: ArgumentType
): IArgumentVisibilityCondition => {
    const nextCondition: IArgumentVisibilityCondition = {
        argument: condition.argument,
        operator: condition.operator
    };

    if (!isMultiValueVisibilityOperator(condition.operator)) {
        const value = parseVisibilityValue(rawValue, referenceType);
        if (value !== undefined) {
            nextCondition.value = value;
        }

        return nextCondition;
    }

    const values = rawValue
        .split(',')
        .map((entry) => parseVisibilityValue(entry, referenceType))
        .filter((entry): entry is VisibilityValue => entry !== undefined);

    if (values.length > 0) {
        nextCondition.values = values;
    }

    return nextCondition;
};
