import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';

export const PLUGIN_TOKENS = Object.freeze({
    PluginHttpService: Symbol.for('PluginHttpService'),
    PluginRepository: COMPUTE_TOKENS.PluginRepository,
    PluginStorageService: Symbol.for('PluginStorageService'),
    WorkflowValidatorService: Symbol.for('WorkflowValidatorService'),
    PluginDependencyResolverService: Symbol.for('PluginDependencyResolverService'),
    PluginExecutionRouter: Symbol.for('PluginExecutionRouter'),
    PluginExposureExportService: Symbol.for('PluginExposureExportService'),
    RegistryGateway: Symbol.for('RegistryGateway')
});
