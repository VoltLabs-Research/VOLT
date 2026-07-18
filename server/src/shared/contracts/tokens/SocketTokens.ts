/**
 * Neutral, cross-module DI token symbols for the SOCKET kernel module.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): these
 * keys are the SAME `Symbol.for(...)` instances used by the owner module's
 * `SOCKET_TOKENS`, so registration and resolution are byte-identical at
 * runtime. Hosting them here lets a consumer inject the socket emitter / a
 * socket module without importing `@modules/socket`.
 */
export const SOCKET_CONTRACT_TOKENS = Object.freeze({
    SocketEmitter: Symbol.for('SocketEmitter')
});
