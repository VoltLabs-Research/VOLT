/**
 * Neutral, cross-module DI token symbols for shared INFRASTRUCTURE services.
 *
 * Part of the `shared/contracts` layer (see ECOSYSTEM "VOLT Apps" migration):
 * any symbol consumed by more than one module lives here so that no module has
 * to `import` from `@modules/<other>` to obtain a token. These are plain
 * `Symbol.for(...)` registrations — type-erased at runtime, safe to import from
 * anywhere without pulling in a module's code.
 */
export const INFRA_TOKENS = Object.freeze({
    StorageService: Symbol.for('StorageService'),
    TempFileService: Symbol.for('TempFileService'),
    TempStorageLifecycleService: Symbol.for('TempStorageLifecycleService'),
    EventBus: Symbol.for('EventBus'),
    RedisClient: Symbol.for('RedisClient'),
    FileExtractorService: Symbol.for('FileExtractorService')
});
