/**
 * Tier of a detachable module. Tiers express a coarse layering used purely for
 * registration/boot ordering (kernel first, client-only last) — they do NOT by
 * themselves imply dependencies. Hard/soft deps are declared explicitly via
 * `requires`/`optional`.
 */
export type ModuleTier = 'kernel' | 'capability' | 'compute' | 'leaf' | 'client-only';

/**
 * Static description of a detachable module, declared with {@link defineModule}.
 * This is the Django-`INSTALLED_APPS`-style unit the {@link ModuleRegistry}
 * resolves, validates, and orders. It is intentionally pure data (no behavior,
 * no DI, no side effects).
 */
export interface ModuleManifest {
    /** Stable, unique identifier for the module, e.g. `'latex'`. */
    key: string;
    /** Coarse layering bucket used for ordering. See {@link ModuleTier}. */
    tier: ModuleTier;
    /**
     * Hard dependencies: keys of modules that MUST be enabled for this module to
     * function. Enabling this module transitively force-enables them, and boot is
     * refused if any required key does not exist as a registered manifest.
     */
    requires?: string[];
    /**
     * Soft dependencies: keys of modules that enhance this one if present but are
     * not mandatory. The module must degrade gracefully when they are absent.
     */
    optional?: string[];
    /** Capability/resource names this module provides to others. */
    provides?: string[];
    /** Lower registers earlier within a tier (default {@link DEFAULT_PRIORITY}). */
    priority?: number;
    /** Human-readable summary of what the module does. */
    description?: string;
}

/**
 * Modules that can never be detached: the server cannot boot without them.
 * They are always force-included by {@link ModuleRegistry.resolveEnabled} and
 * their exclusion is treated as a validation error.
 */
export const KERNEL_MODULES: readonly string[] = ['auth', 'session', 'socket', 'team'];

/** Default `priority` applied to a manifest that does not specify one. */
export const DEFAULT_PRIORITY = 100;
