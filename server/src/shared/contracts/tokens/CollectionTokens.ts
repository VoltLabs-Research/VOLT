/**
 * Neutral DI collection token for member-content counters (detachable-modules
 * migration). Feature modules register an `IMemberContentCounter` via
 * `@CollectionMember(MEMBER_CONTENT_COUNTER_TOKEN)`; the team module resolves
 * them all with `@injectAll(...)`. Hosting the token here lets both sides avoid
 * importing each other's modules.
 */
export const MEMBER_CONTENT_COUNTER_TOKEN = Symbol.for('MemberContentCounter');
