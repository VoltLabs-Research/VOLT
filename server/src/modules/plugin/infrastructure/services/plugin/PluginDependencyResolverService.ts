import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
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

    getPluginNodeReferences(plugin: Plugin): PluginDependencyReference[] {
        return plugin.props.workflow.props.nodes
            .filter((node) => node.type === WorkflowNodeType.Plugin)
            .map((node) => ({
                nodeId: node.id,
                pluginId: node.data.pluginNode?.pluginId?.trim() ?? ''
            }))
            .filter((reference) => Boolean(reference.pluginId));
    }

    private async visitPluginDependencies(
        plugin: Plugin,
        rootPluginId: string,
        visited: Set<string>,
        stack: Set<string>,
        dependencies: Map<string, Plugin>,
        errors: string[]
    ): Promise<void> {
        const pluginNodeReferences = plugin.props.workflow.props.nodes
            .filter((node) => node.type === WorkflowNodeType.Plugin)
            .map((node) => ({
                nodeId: node.id,
                pluginId: node.data.pluginNode?.pluginId?.trim() ?? ''
            }))
            .filter((reference) => Boolean(reference.pluginId));

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
