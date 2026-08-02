import {
    ArgumentType,
    type ArgumentDefinition
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import { isArgumentVisible } from '@modules/plugin/services/plugin/ArgumentVisibility';
import { resolveArgumentExecutionValue } from '@modules/plugin/services/plugin/plugin-reference-mappings';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

export interface PluginReferenceExecutionRequest {
    referencePath: string;
    pluginId: string;
    config: Record<string, unknown>;
}

export interface PluginReferenceValidationTarget extends PluginReferenceExecutionRequest {
    allowedPluginIds: string[];
    allowedPluginKeys: string[];
    definition: ArgumentDefinition;
    definitions: ArgumentDefinition[];
    scopeValues: Record<string, unknown>;
}

interface PluginReferenceSelectionValue {
    pluginId: string;
    config: Record<string, unknown>;
}

/**
 * A pluginReference argument value is authored in the editor and stored as-is, so
 * its selections are shape-checked rather than trusted.
 */
const readPluginReferenceSelections = (
    value: unknown
): PluginReferenceSelectionValue[] => {
    const selections = isRecord(value) ? value.selections : undefined;
    if (!Array.isArray(selections)) {
        return [];
    }

    return selections
        .filter((entry) => isRecord(entry) && typeof entry.pluginId === 'string' && entry.pluginId.trim().length > 0)
        .map((entry) => ({
            pluginId: entry.pluginId.trim(),
            config: isRecord(entry.config) ? entry.config : {}
        }));
};

const normalizeStringList = (value: string[] | undefined): string[] => {
    return Array.from(new Set((value ?? [])
        .map((entry) => entry.trim())
        .filter(Boolean)));
};

const visitArgument = (
    definitions: ArgumentDefinition[],
    definition: ArgumentDefinition,
    value: unknown,
    scopeValues: Record<string, unknown>,
    currentPath: string,
    results: PluginReferenceValidationTarget[],
    errors: string[]
): void => {
    if (!isArgumentVisible(definition, definitions, scopeValues)) {
        return;
    }

    const resolvedValue = resolveArgumentExecutionValue(definition, value);

    if (definition.type === ArgumentType.PLUGIN_REFERENCE) {
        const selections = readPluginReferenceSelections(resolvedValue);
        if (definition.required === true && selections.length === 0) {
            errors.push(`Plugin reference argument "${currentPath}" requires a plugin selection`);
            return;
        }

        if (definition.multipleSelection !== true && selections.length > 1) {
            errors.push(`Plugin reference argument "${currentPath}" only allows one selected plugin`);
            return;
        }

        for (const selection of selections) {
            results.push({
                referencePath: currentPath,
                pluginId: selection.pluginId,
                config: selection.config,
                allowedPluginIds: normalizeStringList(definition.pluginReferenceFilter),
                allowedPluginKeys: normalizeStringList(definition.pluginReferenceFilterKeys),
                definition,
                definitions,
                scopeValues
            });
        }
        return;
    }

    if (definition.type !== ArgumentType.LIST || !Array.isArray(resolvedValue)) {
        return;
    }

    const nestedDefinitions = definition.listArguments ?? [];
    resolvedValue.forEach((entry, index) => {
        if (!isRecord(entry)) {
            return;
        }

        for (const nestedDefinition of nestedDefinitions) {
            visitArgument(
                nestedDefinitions,
                nestedDefinition,
                entry[nestedDefinition.argument],
                entry,
                `${currentPath}[${index}].${nestedDefinition.argument}`,
                results,
                errors
            );
        }
    });
};

/**
 * Walks an argument config, including nested list items, and reports every plugin
 * the config selects through a pluginReference argument. Cardinality problems
 * (a required reference left empty, several plugins in a single-selection
 * argument) are appended to `errors` as they are found.
 */
export const collectPluginReferenceValidationTargets = (
    definitions: ArgumentDefinition[],
    config: Record<string, unknown>,
    errors: string[]
): PluginReferenceValidationTarget[] => {
    const targets: PluginReferenceValidationTarget[] = [];

    for (const definition of definitions) {
        visitArgument(
            definitions,
            definition,
            config[definition.argument],
            config,
            definition.argument,
            targets,
            errors
        );
    }

    return targets;
};
