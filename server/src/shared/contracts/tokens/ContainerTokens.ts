/**
 * Neutral, cross-module DI token symbol for the Container repository.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): the key
 * is the SAME `Symbol.for('ContainerRepository')` used by the owner module's
 * `CONTAINER_TOKENS.ContainerRepository`, so registration and resolution are
 * byte-identical at runtime. Hosting it here lets a consumer inject the
 * container repository without importing `@modules/container`.
 */
export const CONTAINER_CONTRACT_TOKENS = Object.freeze({
    ContainerRepository: Symbol.for('ContainerRepository'),
    ContainerDeploymentProgressService: Symbol.for('ContainerDeploymentProgressService')
});
