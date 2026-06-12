/**
 * Neutral, cross-module DI token symbols for the System domain.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): the keys
 * are the SAME `Symbol.for(...)` instances used by the owner module's
 * `SYSTEM_TOKENS`, so registration and resolution are byte-identical at runtime.
 * Hosting them here lets a consumer inject system-owned services (e.g. the
 * deployment-settings repository) without importing `@modules/system`.
 */
export const SYSTEM_CONTRACT_TOKENS = Object.freeze({
    DeploymentSettingsRepository: Symbol.for('DeploymentSettingsRepository')
});
