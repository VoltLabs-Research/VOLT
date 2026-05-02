import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import type {
    ArgumentDefinition,
    PluginReferenceArgumentMapping
} from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import { ArgumentType } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { isArgumentVisible } from '@modules/plugin/utilities/plugin/argument-visibility';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

interface PluginDependencyTraversalResult {
    dependencies: Plugin[];
    errors: string[];
}

interface PluginDependencyReference {
    nodeId: string;
    pluginId: string;
}

interface PluginReferenceExecutionRequest {
    referencePath: string;
    pluginId: string;
    config: Record<string, unknown>;
}

interface PluginReferenceValidationTarget extends PluginReferenceExecutionRequest {
    allowedPluginIds: string[];
    allowedPluginKeys: string[];
    definition: ArgumentDefinition;
    definitions: ArgumentDefinition[];
    scopeValues: Record<string, unknown>;
}

interface PluginReferenceValidationResult {
    executions: PluginReferenceExecutionRequest[];
    plugins: Plugin[];
    errors: string[];
}

const resolveArgumentExecutionValue = (
    definition: ArgumentDefinition,
    value: unknown
): unknown => {
    if (value !== undefined) {
        return value;
    }

    if (definition.value !== undefined) {
        return definition.value;
    }

    return definition.default;
};

interface PluginReferenceSelectionValue {
    pluginId: string;
    config?: Record<string, unknown>;
}

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

const normalizePluginReferenceMappings = (
    mappings: PluginReferenceArgumentMapping[] | undefined
): PluginReferenceArgumentMapping[] => {
    if (!Array.isArray(mappings)) {
        return [];
    }

    return mappings.flatMap((mapping) => {
        if (!mapping || typeof mapping !== 'object') {
            return [];
        }

        const sourceArgument = typeof mapping.sourceArgument === 'string'
            ? mapping.sourceArgument.trim()
            : '';
        const targetArgument = typeof mapping.targetArgument === 'string'
            ? mapping.targetArgument.trim()
            : '';

        if (!sourceArgument || !targetArgument) {
            return [];
        }

        const targetPluginId = typeof mapping.targetPluginId === 'string'
            ? mapping.targetPluginId.trim()
            : '';
        const targetPluginKey = typeof mapping.targetPluginKey === 'string'
            ? mapping.targetPluginKey.trim()
            : '';

        return [{
            sourceArgument,
            targetArgument,
            ...(targetPluginId ? { targetPluginId } : {}),
            ...(targetPluginKey ? { targetPluginKey } : {}),
            ...(isRecord(mapping.valueMap) ? { valueMap: mapping.valueMap } : {})
        }];
    });
};

const getPluginModifierKey = (plugin: Plugin): string => {
    const modifierKey = plugin.props.modifier?.key;
    if (typeof modifierKey === 'string') {
        return modifierKey.trim();
    }

    const modifierNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Modifier);
    const workflowModifierKey = modifierNode?.data.modifier?.key;
    return typeof workflowModifierKey === 'string' ? workflowModifierKey.trim() : '';
};

const resolveMappingSourceValue = (
    mapping: PluginReferenceArgumentMapping,
    definitions: ArgumentDefinition[],
    scopeValues: Record<string, unknown>
): unknown => {
    const sourceDefinition = definitions.find((definition) => definition.argument === mapping.sourceArgument);
    const value = sourceDefinition
        ? resolveArgumentExecutionValue(sourceDefinition, scopeValues[mapping.sourceArgument])
        : scopeValues[mapping.sourceArgument];

    if (!isRecord(mapping.valueMap)) {
        return value;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const valueMapKey = String(value);
        if (Object.prototype.hasOwnProperty.call(mapping.valueMap, valueMapKey)) {
            return mapping.valueMap[valueMapKey];
        }
    }

    return value;
};

const applyPluginReferenceMappings = (
    target: {
        pluginId: string;
        config: Record<string, unknown>;
        definition: ArgumentDefinition;
        definitions: ArgumentDefinition[];
        scopeValues: Record<string, unknown>;
    },
    referencedPlugin?: Plugin
): Record<string, unknown> => {
    const mappings = normalizePluginReferenceMappings(target.definition.pluginReferenceMappings);
    if (mappings.length === 0) {
        return target.config;
    }

    const pluginKey = referencedPlugin ? getPluginModifierKey(referencedPlugin) : '';
    const config = { ...target.config };

    for (const mapping of mappings) {
        if (mapping.targetPluginId && mapping.targetPluginId !== target.pluginId) {
            continue;
        }

        if (mapping.targetPluginKey && mapping.targetPluginKey !== pluginKey) {
            continue;
        }

        const mappedValue = resolveMappingSourceValue(mapping, target.definitions, target.scopeValues);
        if (mappedValue === undefined) {
            continue;
        }

        config[mapping.targetArgument] = mappedValue;
    }

    return config;
};

const collectArgumentPluginReferenceExecutions = (
    definitions: ArgumentDefinition[],
    definition: ArgumentDefinition,
    value: unknown,
    scopeValues: Record<string, unknown>,
    currentPath: string,
    results: PluginReferenceExecutionRequest[]
): void => {
    if (!isArgumentVisible(definition, definitions, scopeValues)) {
        return;
    }

    const resolvedValue = resolveArgumentExecutionValue(definition, value);

    if (definition.type === ArgumentType.PluginReference) {
        for (const selection of readPluginReferenceSelections(resolvedValue)) {
            results.push({
                referencePath: currentPath,
                pluginId: selection.pluginId,
                config: applyPluginReferenceMappings({
                    pluginId: selection.pluginId,
                    config: selection.config ?? {},
                    definition,
                    definitions,
                    scopeValues
                })
            });
        }
        return;
    }

    if (definition.type === ArgumentType.List && Array.isArray(resolvedValue)) {
        const nestedDefinitions = definition.listArguments ?? [];
        resolvedValue.forEach((entry, index) => {
            if (!isRecord(entry)) {
                return;
            }

            for (const nestedDefinition of nestedDefinitions) {
                collectArgumentPluginReferenceExecutions(
                    nestedDefinitions,
                    nestedDefinition,
                    entry[nestedDefinition.argument],
                    entry,
                    `${currentPath}[${index}].${nestedDefinition.argument}`,
                    results
                );
            }
        });
    }
};

const collectArgumentPluginReferenceValidationTargets = (
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

    if (definition.type === ArgumentType.PluginReference) {
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
                config: selection.config ?? {},
                allowedPluginIds: normalizeStringList(definition.pluginReferenceFilter),
                allowedPluginKeys: normalizeStringList(definition.pluginReferenceFilterKeys),
                definition,
                definitions,
                scopeValues
            });
        }
        return;
    }

    if (definition.type === ArgumentType.List && Array.isArray(resolvedValue)) {
        const nestedDefinitions = definition.listArguments ?? [];
        resolvedValue.forEach((entry, index) => {
            if (!isRecord(entry)) {
                return;
            }

            for (const nestedDefinition of nestedDefinitions) {
                collectArgumentPluginReferenceValidationTargets(
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
    }
};

@Singleton()
export class PluginDependencyResolverService {
    constructor(
        private readonly pluginRepository: PluginRepository
    ) {}

    async collectTransitivePublishedDependencies(plugin: Plugin): Promise<PluginDependencyTraversalResult> {
        const visited = new Set<string>([plugin.id]);
        const stack = new Set<string>([plugin.id]);
        const dependencies = new Map<string, Plugin>();
        const errors: string[] = [];

        await this.visitPluginDependencies(plugin, plugin.id, visited, stack, dependencies, errors);

        return {
            dependencies: Array.from(dependencies.values()),
            errors
        };
    }

    async collectTransitivePublishedDependenciesForPlugins(
        plugins: Plugin[]
    ): Promise<PluginDependencyTraversalResult> {
        const dependencies = new Map<string, Plugin>();
        const errors = new Set<string>();

        for (const plugin of plugins) {
            const result = await this.collectTransitivePublishedDependencies(plugin);
            for (const dependency of result.dependencies) {
                dependencies.set(dependency.id, dependency);
            }
            for (const error of result.errors) {
                errors.add(error);
            }
        }

        return {
            dependencies: Array.from(dependencies.values()),
            errors: Array.from(errors)
        };
    }

    getPluginNodeReferences(plugin: Plugin): PluginDependencyReference[] {
        return plugin.props.workflow.props.nodes
            .filter((node) => node.type === WorkflowNodeType.Plugin)
            .map((node) => ({
                nodeId: node.id,
                pluginId: node.data.pluginNode?.pluginId?.trim() ?? ''
            }))
            .filter((reference) => Boolean(reference.pluginId));
    }

    getArgumentPluginReferenceExecutions(
        plugin: Plugin,
        config: Record<string, unknown>
    ): PluginReferenceExecutionRequest[] {
        const argumentsNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
        const definitions = Array.isArray(argumentsNode?.data.arguments?.arguments)
            ? argumentsNode.data.arguments.arguments as ArgumentDefinition[]
            : [];
        const results: PluginReferenceExecutionRequest[] = [];

        for (const definition of definitions) {
            collectArgumentPluginReferenceExecutions(
                definitions,
                definition,
                config[definition.argument],
                config,
                definition.argument,
                results
            );
        }

        return results;
    }

    async validateArgumentPluginReferenceExecutions(
        plugin: Plugin,
        config: Record<string, unknown>
    ): Promise<PluginReferenceValidationResult> {
        const argumentsNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
        const definitions = Array.isArray(argumentsNode?.data.arguments?.arguments)
            ? argumentsNode.data.arguments.arguments as ArgumentDefinition[]
            : [];
        const targets: PluginReferenceValidationTarget[] = [];
        const errors: string[] = [];

        for (const definition of definitions) {
            collectArgumentPluginReferenceValidationTargets(
                definitions,
                definition,
                config[definition.argument],
                config,
                definition.argument,
                targets,
                errors
            );
        }

        const pluginIds = Array.from(new Set(targets.map((target) => target.pluginId)));
        const plugins = pluginIds.length > 0
            ? await this.pluginRepository.findByIds(pluginIds)
            : [];
        const pluginsById = new Map(plugins.map((candidate) => [candidate.id, candidate]));

        for (const target of targets) {
            const referencedPlugin = pluginsById.get(target.pluginId);
            if (!referencedPlugin) {
                errors.push(`Plugin reference argument "${target.referencePath}" selected unknown plugin ${target.pluginId}`);
                continue;
            }

            if (referencedPlugin.props.status !== PluginStatus.Published) {
                errors.push(`Plugin reference argument "${target.referencePath}" selected unpublished plugin ${target.pluginId}`);
                continue;
            }

            const hasIdFilter = target.allowedPluginIds.length > 0;
            const hasKeyFilter = target.allowedPluginKeys.length > 0;
            if (!hasIdFilter && !hasKeyFilter) {
                continue;
            }

            const modifierKey = getPluginModifierKey(referencedPlugin);
            const matchesId = hasIdFilter && target.allowedPluginIds.includes(referencedPlugin.id);
            const matchesKey = hasKeyFilter && modifierKey.length > 0 && target.allowedPluginKeys.includes(modifierKey);
            if (!matchesId && !matchesKey) {
                const allowedDescription = [
                    hasIdFilter ? `ids: ${target.allowedPluginIds.join(', ')}` : '',
                    hasKeyFilter ? `keys: ${target.allowedPluginKeys.join(', ')}` : ''
                ].filter(Boolean).join('; ');
                errors.push(
                    `Plugin reference argument "${target.referencePath}" selected plugin ${target.pluginId}`
                    + ` (${modifierKey || 'no modifier key'}) which is not allowed by ${allowedDescription}`
                );
            }
        }

        const validPlugins = Array.from(new Map(targets
            .map((target) => pluginsById.get(target.pluginId))
            .filter((candidate): candidate is Plugin => Boolean(candidate))
            .map((candidate) => [candidate.id, candidate])
        ).values());

        return {
            executions: targets.map((target) => ({
                referencePath: target.referencePath,
                pluginId: target.pluginId,
                config: applyPluginReferenceMappings(target, pluginsById.get(target.pluginId))
            })),
            plugins: validPlugins,
            errors
        };
    }

    private async visitPluginDependencies(
        plugin: Plugin,
        rootPluginId: string,
        visited: Set<string>,
        stack: Set<string>,
        dependencies: Map<string, Plugin>,
        errors: string[]
    ): Promise<void> {
        const pluginNodeReferences = this.getPluginNodeReferences(plugin);

        if (!pluginNodeReferences.length) {
            return;
        }

        const uniqueIds = Array.from(new Set(pluginNodeReferences.map((reference) => reference.pluginId)));
        const referencedPlugins = await this.pluginRepository.findByIds(uniqueIds);
        const pluginsById = new Map(referencedPlugins.map((dependencyPlugin) => [dependencyPlugin.id, dependencyPlugin]));

        for (const reference of pluginNodeReferences) {
            if (reference.pluginId === rootPluginId) {
                errors.push(`Plugin node ${reference.nodeId} cannot reference the current plugin`);
                continue;
            }

            const dependencyPlugin = pluginsById.get(reference.pluginId);
            if (!dependencyPlugin) {
                errors.push(`Plugin node ${reference.nodeId} references unknown plugin ${reference.pluginId}`);
                continue;
            }

            if (dependencyPlugin.props.status !== PluginStatus.Published) {
                errors.push(`Plugin node ${reference.nodeId} references unpublished plugin ${reference.pluginId}`);
                continue;
            }

            if (stack.has(dependencyPlugin.id)) {
                errors.push(`Plugin dependency cycle detected at plugin ${dependencyPlugin.id}`);
                continue;
            }

            dependencies.set(dependencyPlugin.id, dependencyPlugin);
            if (visited.has(dependencyPlugin.id)) {
                continue;
            }

            visited.add(dependencyPlugin.id);
            stack.add(dependencyPlugin.id);
            await this.visitPluginDependencies(dependencyPlugin, rootPluginId, visited, stack, dependencies, errors);
            stack.delete(dependencyPlugin.id);
        }
    }
}
