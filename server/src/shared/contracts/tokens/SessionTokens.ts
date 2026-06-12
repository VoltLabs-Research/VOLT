/**
 * Neutral, cross-module DI token symbols for the SESSION kernel module.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): the key
 * is the SAME `Symbol.for(...)` instance used by the owner module's
 * `SESSION_TOKENS`, so registration and resolution are byte-identical at
 * runtime. Hosting it here lets a consumer inject the session repository
 * without importing `@modules/session`.
 */
export const SESSION_CONTRACT_TOKENS = Object.freeze({
    SessionRepository: Symbol.for('SessionRepository')
});
