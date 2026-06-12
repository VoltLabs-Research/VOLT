import { moduleRegistry } from '@shared/infrastructure/modules/ModuleRegistry';
import { defineModule } from '@shared/infrastructure/modules/defineModule';
import { readStringArrayEnv } from '@shared/infrastructure/utilities/env';
import logger from '@shared/infrastructure/logger';

/**
 * Central manifest table for the detachable-module system ("VOLT Apps").
 *
 * This is the single source of truth for module DEFINITIONS. The enabled set is
 * a boot-time decision: it comes from the `VOLT_MODULES` env var (a curated
 * subset), or, when unset, defaults to every registered module. Kernel modules
 * (`tier: 'kernel'`) are always force-included and `requires` edges are
 * transitively closed, so a subset only needs to name the leaf features it wants.
 *
 * `requires` lists ONLY hard (call-time) dependencies that must be enabled for
 * the module to function — including kernel deps a module actually injects, so
 * `validate()` reflects the real link graph. Soft/event dependencies live in
 * `optional` as documentation of intent; they are not enforced and the module
 * must degrade gracefully without them.
 */
const MODULE_MANIFESTS = [
    // ---- KERNEL (irreducible, always on as a unit) ----
    // No inter-kernel `requires`: the kernel modules are co-recursive and are
    // force-enabled together by tier, so declaring requires between them would be
    // both redundant and a validation cycle. `system` is kernel because the
    // client reads its public /api/system/config at boot to learn the enabled
    // set — a deployment that dropped it could not start the client.
    defineModule({ key: 'auth', tier: 'kernel', description: 'Identity, OAuth, JWT, current user' }),
    defineModule({ key: 'session', tier: 'kernel', description: 'Session lifecycle' }),
    defineModule({ key: 'socket', tier: 'kernel', description: 'Realtime gateway' }),
    defineModule({ key: 'team', tier: 'kernel', description: 'Teams, membership, RBAC, secret keys' }),
    defineModule({ key: 'system', tier: 'kernel', description: 'Deployment settings + system metrics + boot config' }),

    // ---- CAPABILITY (optional, consumed via ports) ----
    defineModule({ key: 'notification', tier: 'capability', description: 'User notifications' }),
    defineModule({ key: 'jobs', tier: 'capability', requires: ['team'], optional: ['trajectory'], description: 'Background job tracking' }),
    defineModule({ key: 'ai', tier: 'capability', requires: ['team'], description: 'AI conversations + tool registry' }),

    // ---- COMPUTE (mesh; detachable behind shared contracts) ----
    defineModule({ key: 'cluster', tier: 'compute', requires: ['team', 'system'], optional: ['analysis', 'trajectory'], description: 'User compute clusters + object gateway' }),
    defineModule({ key: 'container', tier: 'compute', requires: ['team', 'cluster', 'system'], description: 'Execution containers' }),
    defineModule({ key: 'trajectory', tier: 'compute', requires: ['team', 'cluster'], optional: ['analysis', 'jobs'], description: 'MD trajectories + frames' }),
    defineModule({ key: 'analysis', tier: 'compute', requires: ['team', 'trajectory'], optional: ['cluster', 'jobs'], description: 'Plugin analysis runs' }),
    defineModule({ key: 'plugin', tier: 'compute', requires: ['team'], optional: ['trajectory', 'analysis', 'cluster', 'container'], description: 'Analysis plugins + registry' }),
    defineModule({ key: 'raster', tier: 'compute', requires: ['team', 'trajectory'], optional: ['cluster', 'container'], description: 'Offscreen rasterization' }),
    defineModule({ key: 'simulation-cell', tier: 'compute', requires: ['team'], optional: ['trajectory'], description: 'Simulation cell library' }),

    // ---- LEAF (freely detachable) ----
    defineModule({ key: 'latex', tier: 'leaf', requires: ['team'], optional: ['ai', 'cluster', 'container'], description: 'LaTeX documents + compilation' }),
    defineModule({ key: 'whiteboards', tier: 'leaf', requires: ['team'], optional: ['ai', 'cluster', 'container'], description: 'Collaborative whiteboards' }),
    defineModule({ key: 'chat', tier: 'leaf', requires: ['team'], description: 'Team chat' }),
    defineModule({ key: 'scripting', tier: 'leaf', requires: ['team', 'container'], optional: ['cluster'], description: 'Jupyter notebooks' }),
    defineModule({ key: 'dashboard', tier: 'leaf', requires: ['team'], optional: ['analysis', 'chat', 'container', 'plugin', 'trajectory'], description: 'Dashboard aggregation' }),
    defineModule({ key: 'daily-activity', tier: 'leaf', requires: ['team'], description: 'Activity log' }),
    defineModule({ key: 'early-access', tier: 'leaf', optional: ['team'], description: 'Early-access gating' })
];

let registered = false;
let cachedEnabled: Set<string> | null = null;

/** Register all manifests with the global registry exactly once. */
const ensureRegistered = (): void => {
    if (registered) return;
    for (const manifest of MODULE_MANIFESTS) {
        moduleRegistry.register(manifest);
    }
    registered = true;
};

/**
 * Resolve the enabled-module set from the `VOLT_MODULES` env override (or all
 * registered modules when unset). Kernel is force-included and `requires` are
 * transitively closed. PURE: re-reads the env and re-resolves on every call and
 * does NOT cache — `getEnabledModules()` is the cached accessor the app uses.
 * (The boot-smoke script depends on this re-resolution to test multiple configs
 * in one process.)
 */
export const resolveEnabledModules = (): Set<string> => {
    ensureRegistered();

    const envOverride = readStringArrayEnv('VOLT_MODULES', null);
    const enabled = moduleRegistry.resolveEnabled({ envOverride });

    const { ok, errors } = moduleRegistry.validate(enabled);
    if (!ok) {
        throw new Error(`@modules: invalid enabled-module set:\n  ${errors.join('\n  ')}`);
    }

    return enabled;
};

/**
 * The resolved enabled set the server runs on, cached for the process lifetime
 * after the first call (which happens at boot during route mounting).
 */
export const getEnabledModules = (): Set<string> => {
    if (cachedEnabled) return cachedEnabled;
    cachedEnabled = resolveEnabledModules();
    logger.info(`@modules: enabled=${[...cachedEnabled].sort().join(',')}`);
    return cachedEnabled;
};

/** Whether a given module key is enabled in the resolved set. */
export const isModuleEnabled = (key: string): boolean => getEnabledModules().has(key);
