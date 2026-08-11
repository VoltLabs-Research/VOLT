import { findPluginsByIds } from '@modules/plugin/services/plugin/PluginQueries';
import type { Plugin } from '@modules/plugin/contracts/plugin';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import { WorkflowNodeType } from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import { readArgumentDefinitions } from '@modules/plugin/services/plugin/ArgumentDefinitionValidator';
import {
    collectPluginReferenceValidationTargets,
    type PluginReferenceExecutionRequest,
    type PluginReferenceValidationTarget
} from '@modules/plugin/services/plugin/PluginReferenceArguments';
import {
    applyPluginReferenceMappings,
    getPluginModifierKey
} from '@modules/plugin/services/plugin/plugin-reference-mappings';

export type { PluginReferenceExecutionRequest };

interface PluginDependencyTraversalResult {
    dependencies: Plugin[];
    errors: string[];
}

interface PluginDependencyReference {
    nodeId: string;
    pluginId: string;
}

interface PluginReferenceValidationResult {
    executions: PluginReferenceExecutionRequest[];
    plugins: Plugin[];
    errors: string[];
}

/**
 * A plugin may only ship with published plugins, so both edges that pull another
 * plugin in — a plugin node in the workflow, and a pluginReference argument in the
 * config — are resolved and checked here before an execution is dispatched.
 */
export class PluginDependencyResolverService {
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

    async validateArgumentPluginReferenceExecutions(
        plugin: Plugin,
        config: Record<string, unknown>
    ): Promise<PluginReferenceValidationResult> {
        const errors: string[] = [];
        const targets = collectPluginReferenceValidationTargets(
            readArgumentDefinitions(plugin.props.workflow.props),
            config,
            errors
        );

        const pluginIds = Array.from(new Set(targets.map((target) => target.pluginId)));
        const plugins = pluginIds.length > 0
            ? await findPluginsByIds(pluginIds)
            : [];
        const pluginsById = new Map(plugins.map((candidate) => [candidate.id, candidate]));

        for (const target of targets) {
            const referencedPlugin = pluginsById.get(target.pluginId);
            if (!referencedPlugin) {
                errors.push(`Plugin reference argument "${target.referencePath}" selected unknown plugin ${target.pluginId}`);
                continue;
            }

            if (referencedPlugin.props.status !== PluginStatus.PUBLISHED) {
                errors.push(`Plugin reference argument "${target.referencePath}" selected unpublished plugin ${target.pluginId}`);
                continue;
            }

            this.assertReferenceAllowed(target, referencedPlugin, errors);
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

    /**
     * A pluginReference argument may restrict what it accepts by plugin id, by
     * modifier key, or both; matching either declared filter is enough.
     */
    private assertReferenceAllowed(
        target: PluginReferenceValidationTarget,
        referencedPlugin: Plugin,
        errors: string[]
    ): void {
        const hasIdFilter = target.allowedPluginIds.length > 0;
        const hasKeyFilter = target.allowedPluginKeys.length > 0;
        if (!hasIdFilter && !hasKeyFilter) {
            return;
        }

        const modifierKey = getPluginModifierKey(referencedPlugin);
        const matchesId = hasIdFilter && target.allowedPluginIds.includes(referencedPlugin.id);
        const matchesKey = hasKeyFilter && modifierKey.length > 0 && target.allowedPluginKeys.includes(modifierKey);
        if (matchesId || matchesKey) {
            return;
        }

        const allowedDescription = [
            hasIdFilter ? `ids: ${target.allowedPluginIds.join(', ')}` : '',
            hasKeyFilter ? `keys: ${target.allowedPluginKeys.join(', ')}` : ''
        ].filter(Boolean).join('; ');
        errors.push(
            `Plugin reference argument "${target.referencePath}" selected plugin ${target.pluginId}`
            + ` (${modifierKey || 'no modifier key'}) which is not allowed by ${allowedDescription}`
        );
    }

    private getPluginNodeReferences(plugin: Plugin): PluginDependencyReference[] {
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
        const pluginNodeReferences = this.getPluginNodeReferences(plugin);

        if (!pluginNodeReferences.length) {
            return;
        }

        const uniqueIds = Array.from(new Set(pluginNodeReferences.map((reference) => reference.pluginId)));
        const referencedPlugins = await findPluginsByIds(uniqueIds);
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

            if (dependencyPlugin.props.status !== PluginStatus.PUBLISHED) {
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
