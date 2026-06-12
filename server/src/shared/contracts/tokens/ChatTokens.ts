/**
 * Neutral, cross-module DI token symbol for the Chat repository.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): the key
 * is the SAME `Symbol.for('ChatRepository')` used by the owner module's
 * `CHAT_TOKENS.ChatRepository`, so registration and resolution are
 * byte-identical at runtime. Hosting it here lets a consumer inject the chat
 * repository without importing `@modules/chat`.
 */
export const CHAT_CONTRACT_TOKENS = Object.freeze({
    ChatRepository: Symbol.for('ChatRepository')
});
