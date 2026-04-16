import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { ArgumentType } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import type { ArgumentDefinition } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { isArgumentVisible } from '@modules/plugin/utilities/plugin/argument-visibility';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { injectable, inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

interface PluginDependencyTraversalResult {
    dependencies: Plugin[];
    errors: string[];
};

interface PluginDependencyReference {
    nodeId: string;
    pluginId: string;
};

interface PluginReferenceExecutionRequest {
    referencePath: string;
    pluginId: string;
    config: Record<string, unknown>;
};

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
    if (isRecord(value) && Array.isArray(value.selections)) {
        return value.selections.filter((entry): entry is PluginReferenceSelectionValue => {
            return isRecord(entry) && typeof entry.pluginId === 'string' && entry.pluginId.trim().length > 0;
        });
    }

    if (Array.isArray(value)) {
        return value.filter((entry): entry is PluginReferenceSelectionValue => {
            return isRecord(entry) && typeof entry.pluginId === 'string' && entry.pluginId.trim().length > 0;
        });
    }

    if (isRecord(value) && typeof value.pluginId === 'string' && value.pluginId.trim().length > 0) {
        return [{
            pluginId: value.pluginId,
            config: isRecord(value.config) ? value.config : {}
        }];
    }

    return [];
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
                pluginId: selection.pluginId.trim(),
                config: isRecord(selection.config) ? selection.config : {}
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

@injectable()
export class PluginDependencyResolverService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
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
