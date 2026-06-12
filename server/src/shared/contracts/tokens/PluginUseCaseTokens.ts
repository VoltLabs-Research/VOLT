/**
 * Neutral, cross-module DI token symbols for PLUGIN use-cases that are driven
 * (injected + `.execute()`-called) outside the plugin module.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): the
 * trajectory module's public-canvas + download use-cases inject these plugin
 * use-cases by their concrete class today. To let trajectory depend on the
 * neutral `IGet*UseCase` ports instead of `@modules/plugin`, each concrete use
 * case additively registers under the token here via `@AliasOf(...)`. Keys are
 * NEW `Symbol.for(...)` strings (no prior registration used these symbols), and
 * the alias delegates to the same class instance — so by-class resolution
 * inside the plugin module is unchanged and the neutral token resolves to the
 * identical implementation.
 */
export const PLUGIN_USECASE_TOKENS = Object.freeze({
    GetPluginByIdUseCase: Symbol.for('GetPluginByIdUseCase'),
    GetPluginExposureGLBUseCase: Symbol.for('GetPluginExposureGLBUseCase'),
    GetPluginExposureExportUseCase: Symbol.for('GetPluginExposureExportUseCase'),
    GetPluginListingDocumentsUseCase: Symbol.for('GetPluginListingDocumentsUseCase'),
    GetSubListingUseCase: Symbol.for('GetSubListingUseCase')
});
