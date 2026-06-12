import type { ModuleManifest, ModuleTier } from './types';
import { DEFAULT_PRIORITY, KERNEL_MODULES } from './types';

/** Ordering rank per tier; lower sorts earlier. */
const TIER_RANK: Record<ModuleTier, number> = {
    kernel: 0,
    capability: 1,
    compute: 2,
    leaf: 3,
    'client-only': 4
};

/** Result of {@link ModuleRegistry.validate}. */
export interface ValidationResult {
    ok: boolean;
    errors: string[];
}

/**
 * Django-`INSTALLED_APPS`-style registry of detachable modules. It is a pure,
 * in-memory bookkeeping layer: it does not read the environment, touch the
 * database, or wire DI. Callers gather the relevant inputs (env override list,
 * DB-enabled list) and pass them in, then act on the resolved/validated set.
 *
 * Typical flow:
 * ```ts
 * const enabled = moduleRegistry.resolveEnabled({ envOverride, dbEnabled });
 * const { ok, errors } = moduleRegistry.validate(enabled);
 * if (!ok) throw new Error(errors.join('\n'));
 * for (const m of moduleRegistry.orderedEnabled(enabled)) boot(m);
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
     * Resolve the closed set of enabled module keys.
     *
     * Precedence for the initial seed: `envOverride ?? dbEnabled ?? all
     * registered keys`. The {@link KERNEL_MODULES} are then force-included, and
     * finally the set is transitively closed over `requires` edges so that
     * enabling a module auto-enables its hard dependencies.
     *
     * Unknown keys in the seed are kept (so {@link validate} can report them);
     * unknown `requires` targets cannot be expanded and are likewise surfaced by
     * {@link validate}.
     */
    resolveEnabled(options: { envOverride?: string[] | null; dbEnabled?: string[] | null }): Set<string> {
        const { envOverride, dbEnabled } = options;
        const seed = envOverride ?? dbEnabled ?? [...this.manifests.keys()];

        const enabled = new Set<string>(seed);
        for (const kernelKey of KERNEL_MODULES) enabled.add(kernelKey);

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
     * - no {@link KERNEL_MODULES} entry may be excluded;
     * - there must be no cycle among `requires` edges within the enabled set.
     */
    validate(enabled: Set<string>): ValidationResult {
        const errors: string[] = [];

        // Kernel modules must never be excluded.
        for (const kernelKey of KERNEL_MODULES) {
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
     * Enabled manifests sorted deterministically by tier rank, then `priority`
     * (default {@link DEFAULT_PRIORITY}), then key. Keys in the enabled set with
     * no registered manifest are skipped.
     */
    orderedEnabled(enabled: Set<string>): ModuleManifest[] {
        const manifests: ModuleManifest[] = [];
        for (const key of enabled) {
            const manifest = this.manifests.get(key);
            if (manifest) manifests.push(manifest);
        }

        return manifests.sort((a, b) => {
            const tierDelta = TIER_RANK[a.tier] - TIER_RANK[b.tier];
            if (tierDelta !== 0) return tierDelta;
            const priorityDelta = (a.priority ?? DEFAULT_PRIORITY) - (b.priority ?? DEFAULT_PRIORITY);
            if (priorityDelta !== 0) return priorityDelta;
            return a.key.localeCompare(b.key);
        });
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
