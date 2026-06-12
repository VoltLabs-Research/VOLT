import type { ModuleManifest } from './types';

/** Result of {@link ModuleRegistry.validate}. */
export interface ValidationResult {
    ok: boolean;
    errors: string[];
}

/**
 * Django-`INSTALLED_APPS`-style registry of detachable modules. It is a pure,
 * in-memory bookkeeping layer: it does not read the environment, touch the
 * database, or wire DI. Callers gather the relevant inputs (env override list)
 * and pass them in, then act on the resolved/validated set.
 *
 * Typical flow:
 * ```ts
 * const enabled = moduleRegistry.resolveEnabled({ envOverride });
 * const { ok, errors } = moduleRegistry.validate(enabled);
 * if (!ok) throw new Error(errors.join('\n'));
 * ```
 */
export class ModuleRegistry {
    private readonly manifests = new Map<string, ModuleManifest>();

    /**
     * Store a manifest under its key.
     * @throws if a module with the same key was already registered.
     */
    register(manifest: ModuleManifest): void {
        if (this.manifests.has(manifest.key)) {
            throw new Error(`Module "${manifest.key}" is already registered.`);
        }
        this.manifests.set(manifest.key, manifest);
    }

    /** All registered manifests, in registration order. */
    all(): ModuleManifest[] {
        return [...this.manifests.values()];
    }

    /**
     * Keys of all registered modules whose tier is `kernel`. Kernel modules can
     * never be detached: they are always force-included by {@link resolveEnabled}
     * and their exclusion is a validation error. Derived from the manifests so
     * there is a single source of truth for "is kernel".
     */
    kernelKeys(): string[] {
        return this.all().filter((m) => m.tier === 'kernel').map((m) => m.key);
    }

    /**
     * Resolve the closed set of enabled module keys.
     *
     * Precedence for the initial seed: `envOverride ?? all registered keys`. The
     * kernel modules are then force-included, and finally the set is transitively
     * closed over `requires` edges so that enabling a module auto-enables its
     * hard dependencies.
     *
     * Unknown keys in the seed are kept (so {@link validate} can report them);
     * unknown `requires` targets cannot be expanded and are likewise surfaced by
     * {@link validate}.
     */
    resolveEnabled(options: { envOverride?: string[] | null }): Set<string> {
        const { envOverride } = options;
        const seed = envOverride ?? [...this.manifests.keys()];

        const enabled = new Set<string>(seed);
        for (const kernelKey of this.kernelKeys()) enabled.add(kernelKey);

        // Transitively pull in hard dependencies of everything enabled so far.
        const queue = [...enabled];
        while (queue.length > 0) {
            const key = queue.shift() as string;
            const manifest = this.manifests.get(key);
            if (!manifest?.requires) continue;
            for (const dep of manifest.requires) {
                if (!enabled.has(dep)) {
                    enabled.add(dep);
                    queue.push(dep);
                }
            }
        }

        return enabled;
    }

    /**
     * Validate an enabled set:
     * - every `requires` target of an enabled module must EXIST as a registered
     *   manifest and be present in the enabled set;
     * - no kernel module may be excluded;
     * - there must be no cycle among `requires` edges within the enabled set.
     */
    validate(enabled: Set<string>): ValidationResult {
        const errors: string[] = [];

        // Kernel modules must never be excluded.
        for (const kernelKey of this.kernelKeys()) {
            if (!enabled.has(kernelKey)) {
                errors.push(`Kernel module "${kernelKey}" must be enabled but was excluded.`);
            }
        }

        // Hard-dependency integrity.
        for (const key of enabled) {
            const manifest = this.manifests.get(key);
            if (!manifest?.requires) continue;
            for (const dep of manifest.requires) {
                if (!this.manifests.has(dep)) {
                    errors.push(`Module "${key}" requires unknown module "${dep}".`);
                } else if (!enabled.has(dep)) {
                    errors.push(`Module "${key}" requires "${dep}", which is not enabled.`);
                }
            }
        }

        for (const cycle of this.findRequiresCycles(enabled)) {
            errors.push(`Requires-cycle detected: ${cycle.join(' -> ')}.`);
        }

        return { ok: errors.length === 0, errors };
    }

    /** Whether `key` is in the given enabled set. */
    isEnabled(key: string, enabled: Set<string>): boolean {
        return enabled.has(key);
    }

    /**
     * Detect cycles among `requires` edges restricted to the enabled set using a
     * colour-marking DFS. Returns one representative path per discovered cycle.
     */
    private findRequiresCycles(enabled: Set<string>): string[][] {
        const WHITE = 0, GREY = 1, BLACK = 2;
        const color = new Map<string, number>();
        const stack: string[] = [];
        const cycles: string[][] = [];

        const visit = (key: string): void => {
            color.set(key, GREY);
            stack.push(key);

            const manifest = this.manifests.get(key);
            for (const dep of manifest?.requires ?? []) {
                // Only traverse edges to enabled, registered modules.
                if (!enabled.has(dep) || !this.manifests.has(dep)) continue;
                const depColor = color.get(dep) ?? WHITE;
                if (depColor === WHITE) {
                    visit(dep);
                } else if (depColor === GREY) {
                    // Back-edge: slice the current stack from `dep` to form the cycle.
                    const start = stack.indexOf(dep);
                    cycles.push([...stack.slice(start), dep]);
                }
            }

            stack.pop();
            color.set(key, BLACK);
        };

        for (const key of enabled) {
            if (!this.manifests.has(key)) continue;
            if ((color.get(key) ?? WHITE) === WHITE) visit(key);
        }

        return cycles;
    }
}

/**
 * Process-wide singleton. Exported as a convenience for the common case; the
 * class itself can be instantiated directly in tests for full isolation.
 */
export const moduleRegistry = new ModuleRegistry();
