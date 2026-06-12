/**
 * Neutral, cross-module DI token symbols for the AUTH kernel module.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): these
 * keys are the SAME `Symbol.for(...)` instances used by the owner module's
 * `AUTH_TOKENS`, so registration and resolution are byte-identical at runtime.
 * Hosting them here lets a consumer inject auth-owned services (user lookup,
 * password hashing, token issuance) without importing `@modules/auth`.
 */
export const AUTH_CONTRACT_TOKENS = Object.freeze({
    UserRepository: Symbol.for('UserRepository'),
    PasswordHasher: Symbol.for('PasswordHasher'),
    TokenService: Symbol.for('TokenService')
});
