import { ArgumentType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { getVisibleArguments, isArgumentVisible } from '@/modules/plugin/utilities/plugin/argument-visibility';
import type {
    IArgumentDefinition,
    IPluginReferenceSelection,
    IPluginReferenceValue
} from '@/modules/plugin/api/entities/plugin/workflow';
import { isRecord } from '@/shared/utils/type-guards';

interface ArgumentObjectValue {
    [key: string]: unknown;
};

const isListItemArray = (value: unknown): value is ArgumentObjectValue[] => {
    return Array.isArray(value) && value.every(isRecord);
};

const isStringArray = (value: unknown): value is string[] => {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
};

const readBooleanValue = (value: unknown): boolean => {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        return value === 'true';
    }

    return Boolean(value);
};

const readNumberFieldValue = (value: unknown): number | string => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        return value;
    }

    return '';
};

const readRuntimeNumberValue = (value: unknown): number | string => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        if (!value.trim().length) {
            return '';
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
    }

    return '';
};

export const createDefaultArgumentDefinition = (): IArgumentDefinition => {
    return {
        argument: '',
        type: ArgumentType.STRING,
        label: ''
    };
};

export const hasPresetArgumentValue = (definition: IArgumentDefinition): boolean => {
    return definition.value !== undefined;
};

export const isUserConfigurableArgument = (definition: IArgumentDefinition): boolean => {
    return !hasPresetArgumentValue(definition);
};

export const getUserConfigurableArguments = (
    definitions: IArgumentDefinition[]
): IArgumentDefinition[] => {
    return definitions.filter(isUserConfigurableArgument);
};

export const getArgumentDefaultValue = (definition: IArgumentDefinition): unknown => {
    if (definition.default !== undefined) {
        return definition.default;
    }

    if (definition.type === ArgumentType.BOOLEAN) {
        return false;
    }

    if (definition.type === ArgumentType.LIST) {
        return [];
    }

    if (definition.type === ArgumentType.SELECT && definition.multipleSelection) {
        return [];
    }

    if (definition.type === ArgumentType.PLUGIN_REFERENCE) {
        return { selections: [] };
    }

    return '';
};

export const createDefaultListItem = (definitions?: IArgumentDefinition[]): ArgumentObjectValue => {
    const nextItem: ArgumentObjectValue = {};

    for (const definition of definitions ?? []) {
        nextItem[definition.argument] = definition.value ?? getArgumentDefaultValue(definition);
    }

    return nextItem;
};

export const getPrimitiveArgumentFieldValue = (
    definition: IArgumentDefinition,
    value: unknown
): string | number | boolean => {
    const resolvedValue = value ?? definition.default;

    if (definition.type === ArgumentType.BOOLEAN) {
        return readBooleanValue(resolvedValue);
    }

    if (definition.type === ArgumentType.NUMBER) {
        return readNumberFieldValue(resolvedValue);
    }

    if (typeof resolvedValue === 'number' || typeof resolvedValue === 'boolean') {
        return String(resolvedValue);
    }

    if (typeof resolvedValue === 'string') {
        return resolvedValue;
    }

    return '';
};

export const getListArgumentValue = (
    definition: IArgumentDefinition,
    value: unknown
): ArgumentObjectValue[] => {
    if (isListItemArray(value)) {
        return value;
    }

    if (isListItemArray(definition.default)) {
        return definition.default;
    }

    return [];
};

export interface PluginReferenceSelectionValue {
    pluginId: string;
    config: Record<string, unknown>;
};

export const isPluginReferenceArgumentType = (type: ArgumentType): boolean => {
    return type === ArgumentType.PLUGIN_REFERENCE;
};

const isPluginReferenceSelectionValue = (value: unknown): value is PluginReferenceSelectionValue => {
    return isRecord(value) && typeof value.pluginId === 'string';
};

const normalizePluginReferenceSelection = (value: unknown): IPluginReferenceSelection | null => {
    if (!isPluginReferenceSelectionValue(value)) {
        return null;
    }

    const pluginId = value.pluginId.trim();
    if (!pluginId) {
        return null;
    }

    return {
        pluginId,
        config: isRecord(value.config) ? value.config : {}
    };
};

const isPluginReferenceValue = (value: unknown): value is IPluginReferenceValue => {
    return isRecord(value) && Array.isArray(value.selections);
};

const normalizePluginReferenceSelections = (value: unknown): IPluginReferenceSelection[] => {
    if (isPluginReferenceValue(value)) {
        return value.selections
            .map(normalizePluginReferenceSelection)
            .filter((selection): selection is IPluginReferenceSelection => selection !== null);
    }

    if (Array.isArray(value)) {
        return value
            .map(normalizePluginReferenceSelection)
            .filter((selection): selection is IPluginReferenceSelection => selection !== null);
    }

    const legacySelection = normalizePluginReferenceSelection(value);
    return legacySelection ? [legacySelection] : [];
};

export const getPluginReferenceValue = (
    definition: IArgumentDefinition,
    value: unknown
): IPluginReferenceValue => {
    const resolvedSelections = normalizePluginReferenceSelections(value);
    if (resolvedSelections.length > 0) {
        return {
            selections: resolvedSelections
        };
    }

    const defaultSelections = normalizePluginReferenceSelections(definition.default);
    if (defaultSelections.length > 0) {
        return {
            selections: defaultSelections
        };
    }

    return {
        selections: []
    };
};

export const coerceArgumentInputValue = (
    definition: IArgumentDefinition,
    value: unknown
): unknown => {
    if (definition.type === ArgumentType.BOOLEAN) {
        return readBooleanValue(value);
    }

    if (definition.type === ArgumentType.NUMBER) {
        return value;
    }

    if (definition.type === ArgumentType.SELECT && definition.multipleSelection) {
        return isStringArray(value) ? value : [];
    }

    if (definition.type === ArgumentType.PLUGIN_REFERENCE) {
        return getPluginReferenceValue(definition, value);
    }

    return value;
};

export const resolveArgumentRuntimeValue = (
    definition: IArgumentDefinition,
    value: unknown
): unknown => {
    const resolvedValue = value ?? definition.value ?? definition.default;

    if (definition.type === ArgumentType.BOOLEAN) {
        return readBooleanValue(resolvedValue);
    }

    if (definition.type === ArgumentType.NUMBER) {
        return readRuntimeNumberValue(resolvedValue);
    }

    if (definition.type === ArgumentType.SELECT && definition.multipleSelection) {
        if (isStringArray(resolvedValue)) {
            return resolvedValue;
        }

        if (typeof resolvedValue === 'string' && resolvedValue.trim().length > 0) {
            return [resolvedValue];
        }

        return [];
    }

    if (definition.type === ArgumentType.LIST) {
        const items = getListArgumentValue(definition, resolvedValue);
        const nestedDefinitions = definition.listArguments ?? [];

        return items.map((item) => {
            const normalizedItem: ArgumentObjectValue = {};

            for (const nestedDefinition of getVisibleArguments(nestedDefinitions, item)) {
                normalizedItem[nestedDefinition.argument] = resolveArgumentRuntimeValue(
                    nestedDefinition,
                    item[nestedDefinition.argument]
                );
            }

            return normalizedItem;
        });
    }

    if (definition.type === ArgumentType.PLUGIN_REFERENCE) {
        return getPluginReferenceValue(definition, resolvedValue);
    }

    return resolvedValue ?? '';
};

export const getSelectArgumentValue = (
    definition: IArgumentDefinition,
    value: unknown
): string | string[] => {
    const resolvedValue = value ?? definition.default;

    if (!definition.multipleSelection) {
        if (typeof resolvedValue === 'string') {
            return resolvedValue;
        }

        if (typeof resolvedValue === 'number' || typeof resolvedValue === 'boolean') {
            return String(resolvedValue);
        }

        return '';
    }

    if (isStringArray(resolvedValue)) {
        return resolvedValue;
    }

    if (typeof resolvedValue === 'string' && resolvedValue.trim().length > 0) {
        return [resolvedValue];
    }

    return [];
};

export const collectDefaultArgumentValues = (definitions: IArgumentDefinition[]): Record<string, unknown> => {
    return collectVisibleDefaultArgumentValues(definitions, {});
};

export const collectVisibleDefaultArgumentValues = (
    definitions: IArgumentDefinition[],
    currentValues: Record<string, unknown>
): Record<string, unknown> => {
    const defaults: Record<string, unknown> = {};

    for (const definition of definitions) {
        if (
            definition.default !== undefined
            && isUserConfigurableArgument(definition)
            && isArgumentVisible(definition, definitions, currentValues)
        ) {
            defaults[definition.argument] = definition.default;
        }
    }

    return defaults;
};
