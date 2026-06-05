import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type { PluginReferenceExecutionRequest } from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';

export interface PluginDependencyTraversalResult {
    dependencies: Plugin[];
    errors: string[];
}

export interface PluginDependencyReference {
    nodeId: string;
    pluginId: string;
}

export interface PluginReferenceValidationResult {
    executions: PluginReferenceExecutionRequest[];
    plugins: Plugin[];
    errors: string[];
}

export interface IPluginDependencyResolverService {
    collectTransitivePublishedDependencies(plugin: Plugin): Promise<PluginDependencyTraversalResult>;
    collectTransitivePublishedDependenciesForPlugins(plugins: Plugin[]): Promise<PluginDependencyTraversalResult>;
    getPluginNodeReferences(plugin: Plugin): PluginDependencyReference[];
    getArgumentPluginReferenceExecutions(plugin: Plugin, config: Record<string, unknown>): PluginReferenceExecutionRequest[];
    validateArgumentPluginReferenceExecutions(plugin: Plugin, config: Record<string, unknown>): Promise<PluginReferenceValidationResult>;
}
