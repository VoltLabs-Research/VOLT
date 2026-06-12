/**
 * Tier of a detachable module. A documentation-only category that communicates
 * a module's coarse layering/role; it carries no runtime ordering logic.
 * `kernel` additionally has enforcement meaning: kernel modules can never be
 * detached (see {@link ModuleRegistry}), and kernel membership is derived
 * from this field — there is no separate hand-maintained kernel list to drift.
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
    /** Coarse layering/role category. See {@link ModuleTier}. */
    tier: ModuleTier;
    /**
     * Hard dependencies: keys of modules that MUST be enabled for this module to
     * function. Enabling this module transitively force-enables them, and boot is
     * refused if any required key does not exist as a registered manifest.
     */
    requires?: string[];
    /**
     * Soft dependencies: keys of modules that enhance this one if present but are
     * not mandatory. Documentation of intent — the module must degrade gracefully
     * when they are absent. Not enforced at runtime.
     */
    optional?: string[];
    /** Human-readable summary of what the module does. */
    description?: string;
}
