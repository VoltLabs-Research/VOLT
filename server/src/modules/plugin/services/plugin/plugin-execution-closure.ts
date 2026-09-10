import { ErrorCodes } from '@core/constants/error-codes';
import type { Plugin } from '@modules/plugin/contracts/plugin';
import pluginDependencyResolverService from '@modules/plugin/services/plugin/PluginDependencyResolverService';
import type { PluginReferenceExecutionRequest } from '@modules/plugin/services/plugin/PluginReferenceArguments';
import ApplicationError from '@shared/errors/ApplicationError';

interface PluginExecutionClosure {
    plugins: Plugin[];
    executions: PluginReferenceExecutionRequest[];
}

export const cannotExecute = (message: string): ApplicationError => {
    return ApplicationError.badRequest(ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE, message);
};

const rejectOnErrors = (errors: string[]): void => {
    if (errors.length) {
        throw cannotExecute(errors.join('; '));
    }
};

export const resolveExecutionClosure = async (
    plugin: Plugin,
    config: Record<string, unknown>
): Promise<PluginExecutionClosure> => {
    const references = await pluginDependencyResolverService.validateArgumentPluginReferenceExecutions(plugin, config);
    rejectOnErrors(references.errors);

    const ownDependencies = await pluginDependencyResolverService.collectTransitivePublishedDependencies(plugin);
    rejectOnErrors(ownDependencies.errors);

    const referencedDependencies = await pluginDependencyResolverService.collectTransitivePublishedDependenciesForPlugins(
        references.plugins
    );
    rejectOnErrors(referencedDependencies.errors);

    const plugins = Array.from(new Map(
        [
            ...ownDependencies.dependencies,
            ...references.plugins,
            ...referencedDependencies.dependencies
        ].map((candidate) => [candidate.id, candidate])
    ).values());

    return {
        plugins,
        executions: references.executions
    };
};
