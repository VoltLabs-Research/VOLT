import { ErrorCodes } from '@core/constants/error-codes';
import type { Plugin } from '@modules/plugin/contracts/plugin';
import type { PluginDependencyResolverService } from '@modules/plugin/services/plugin/PluginDependencyResolverService';
import type { PluginReferenceExecutionRequest } from '@modules/plugin/services/plugin/PluginReferenceArguments';
import ApplicationError from '@shared/application/errors/ApplicationError';

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

/**
 * An execution needs every transitively referenced plugin published and shipped
 * alongside it: the plugin's own dependencies, the plugins its config points at,
 * and those plugins' dependencies in turn. Anything unresolvable at this point is
 * a request the platform cannot run, so it is rejected rather than collected.
 */
export const resolveExecutionClosure = async (
    dependencyResolver: PluginDependencyResolverService,
    plugin: Plugin,
    config: Record<string, unknown>
): Promise<PluginExecutionClosure> => {
    const references = await dependencyResolver.validateArgumentPluginReferenceExecutions(plugin, config);
    rejectOnErrors(references.errors);

    const ownDependencies = await dependencyResolver.collectTransitivePublishedDependencies(plugin);
    rejectOnErrors(ownDependencies.errors);

    const referencedDependencies = await dependencyResolver.collectTransitivePublishedDependenciesForPlugins(
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
