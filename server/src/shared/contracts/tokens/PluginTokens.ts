/**
 * Neutral, cross-module DI token symbols for PLUGIN services that are consumed
 * (injected) outside the plugin module.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): these
 * symbols let a consumer inject the plugin module's services without importing
 * `@modules/plugin`. Keys are `Symbol.for(...)` strings; the global-registry
 * key makes the neutral token and the owner-module class registration resolve to
 * the identical symbol, so registration and resolution are byte-identical at
 * runtime.
 *
 * Note: `PluginRepository` lives in `COMPUTE_TOKENS` (compute mesh). This group
 * hosts plugin services that are not part of the compute mesh.
 */
export const PLUGIN_CONTRACT_TOKENS = Object.freeze({
    PluginDebugSessionRegistryService: Symbol.for('PluginDebugSessionRegistryService')
});
