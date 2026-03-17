import { ArgumentType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';

interface ArgumentObjectValue {
    [key: string]: unknown;
};

const isRecord = (value: unknown): value is ArgumentObjectValue => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isListItemArray = (value: unknown): value is ArgumentObjectValue[] => {
    return Array.isArray(value) && value.every(isRecord);
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

const readNumberValue = (value: unknown): number | string => {
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

    if (definition.type === ArgumentType.PLUGIN_CONFIG) {
        return { pluginId: '', config: {} };
    }

    return '';
};

export const createDefaultListItem = (definitions?: IArgumentDefinition[]): ArgumentObjectValue => {
    const nextItem: ArgumentObjectValue = {};

    for (const definition of definitions ?? []) {
        nextItem[definition.argument] = getArgumentDefaultValue(definition);
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
        return readNumberValue(resolvedValue);
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

export interface PluginConfigValue {
    pluginId: string;
    config: Record<string, unknown>;
};

const isPluginConfigValue = (value: unknown): value is PluginConfigValue => {
    return isRecord(value) && typeof value.pluginId === 'string';
};

export const getPluginConfigValue = (
    definition: IArgumentDefinition,
    value: unknown
): PluginConfigValue => {
    if (isPluginConfigValue(value)) {
        return value;
    }

    if (isPluginConfigValue(definition.default)) {
        return definition.default;
    }

    return { pluginId: '', config: {} };
};

export const coerceArgumentInputValue = (
    definition: IArgumentDefinition,
    value: string | number | boolean
): unknown => {
    if (definition.type === ArgumentType.BOOLEAN) {
        return readBooleanValue(value);
    }

    if (definition.type === ArgumentType.NUMBER) {
        if (typeof value === 'number') {
            return value;
        }

        if (typeof value === 'string') {
            if (!value.trim().length) {
                return '';
            }

            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : value;
        }
    }

    return value;
};

export const collectDefaultArgumentValues = (definitions: IArgumentDefinition[]): Record<string, unknown> => {
    const defaults: Record<string, unknown> = {};

    for (const definition of definitions) {
        if (definition.default !== undefined) {
            defaults[definition.argument] = definition.default;
        }
    }

    return defaults;
};
