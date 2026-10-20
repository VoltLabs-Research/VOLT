import { isRecord } from '@/shared/utils/type-guards';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type {
    IArgumentDefinition,
    IPluginReferenceSelection
} from '@volt/contracts/modules/plugin/workflow';

export const normalizeDynamicOptionValue = (value: unknown): string => {
    if (typeof value === 'string') {
        return value.trim();
    }

    return typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
};

const readDynamicOptionField = (value: unknown, field?: string): string => {
    if (field && isRecord(value)) {
        return normalizeDynamicOptionValue(value[field]);
    }

    return normalizeDynamicOptionValue(value);
};

const resolveExposurePropertyOptions = (
    referenceValue: unknown,
    pluginsById: Record<string, Plugin>
): SelectOption[] => {
    if (!isRecord(referenceValue) || !Array.isArray(referenceValue.selections)) {
        return [];
    }

    const selections: IPluginReferenceSelection[] = referenceValue.selections;
    const options: SelectOption[] = [];

    for (const selection of selections) {
        for (const exposure of pluginsById[selection.pluginId]?.exposures ?? []) {
            for (const property of exposure.properties ?? []) {
                const value = property.key.trim();
                if (!value) {
                    continue;
                }

                options.push({
                    value,
                    title: property.label?.trim() || value
                });
            }
        }
    }

    return options;
};

export const resolveSelectOptions = (
    argument: IArgumentDefinition,
    rootValues: Record<string, unknown>,
    pluginsById: Record<string, Plugin>
): SelectOption[] => {
    const staticOptions = (argument.options ?? []).map((option) => ({
        value: option.key,
        title: option.label
    }));
    const dynamicOptions: SelectOption[] = [];

    for (const source of argument.optionsFromArguments ?? []) {
        const sourceArgument = source.argument?.trim();
        if (!sourceArgument) {
            continue;
        }

        const sourceValue = rootValues[sourceArgument];
        const entries = Array.isArray(sourceValue) ? sourceValue : [sourceValue];
        for (const entry of entries) {
            const optionValue = readDynamicOptionField(entry, source.valueField);
            if (!optionValue) {
                continue;
            }

            dynamicOptions.push({
                value: optionValue,
                title: readDynamicOptionField(entry, source.labelField) || optionValue
            });
        }
    }

    const referenceArgument = argument.optionsFromPluginReference?.trim();
    const pluginReferenceOptions = referenceArgument
        ? resolveExposurePropertyOptions(rootValues[referenceArgument], pluginsById)
        : [];

    const dedupedOptions = new Map<string, SelectOption>();
    for (const option of [...staticOptions, ...dynamicOptions, ...pluginReferenceOptions]) {
        if (!dedupedOptions.has(option.value)) {
            dedupedOptions.set(option.value, option);
        }
    }

    return Array.from(dedupedOptions.values());
};
