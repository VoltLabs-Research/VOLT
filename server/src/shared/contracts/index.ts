/**
 * Top-level barrel for the neutral `shared/contracts` layer.
 *
 * This layer holds cross-module contracts (DI tokens, ports, events, dtos,
 * types) that belong to no single module. Everything here MUST be safe to
 * import from anywhere: type-only declarations or plain const symbol objects,
 * with no `@Singleton`/`@CollectionMember` decorators and no `@modules/*`
 * imports, so the autoloader can scan it harmlessly.
 */
export * from './tokens';
