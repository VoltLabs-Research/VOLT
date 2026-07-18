import type { ModuleManifest } from './types';

export interface ValidationResult {
    ok: boolean;
    errors: string[];
}

export class ModuleRegistry {
    private readonly manifests = new Map<string, ModuleManifest>();

    
    register(manifest: ModuleManifest): void {
        if (this.manifests.has(manifest.key)) {
            throw new Error(`Module "${manifest.key}" is already registered.`);
        }
        this.manifests.set(manifest.key, manifest);
    }

    
    all(): ModuleManifest[] {
        return [...this.manifests.values()];
    }

    
    kernelKeys(): string[] {
        return this.all().filter((m) => m.tier === 'kernel').map((m) => m.key);
    }

    
    resolveEnabled(options: { envOverride?: string[] | null }): Set<string> {
        const { envOverride } = options;
        const seed = envOverride ?? [...this.manifests.keys()];

        const enabled = new Set<string>(seed);
        for (const kernelKey of this.kernelKeys()) enabled.add(kernelKey);

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

    
    validate(enabled: Set<string>): ValidationResult {
        const errors: string[] = [];

        for (const kernelKey of this.kernelKeys()) {
            if (!enabled.has(kernelKey)) {
                errors.push(`Kernel module "${kernelKey}" must be enabled but was excluded.`);
            }
        }

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

    
    isEnabled(key: string, enabled: Set<string>): boolean {
        return enabled.has(key);
    }

    
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
                if (!enabled.has(dep) || !this.manifests.has(dep)) continue;
                const depColor = color.get(dep) ?? WHITE;
                if (depColor === WHITE) {
                    visit(dep);
                } else if (depColor === GREY) {
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

export const moduleRegistry = new ModuleRegistry();
