import { moduleRegistry } from '@shared/infrastructure/modules/ModuleRegistry';
import { defineModule } from '@shared/infrastructure/modules/defineModule';
import { readStringArrayEnv } from '@shared/infrastructure/utilities/env';
import logger from '@shared/infrastructure/logger';

/**
 * Central manifest table for the detachable-module system ("VOLT Apps").
 *
 * During the incremental migration this lives here as one authoritative list;
 * the long-term goal is for each module to ship its own `module.manifest.ts`
 * and self-register. Tiers and `requires` come from the dependency-graph audit:
 * KERNEL {auth, session, socket, team} is irreducible and always enabled.
 *
 * `requires` lists ONLY hard (call-time) dependencies that must be enabled for
 * the module to function; soft/event dependencies are intentionally omitted so
 * they can degrade gracefully.
 */
const MODULE_MANIFESTS = [
    // ---- KERNEL (irreducible, always on as a unit) ----
    // No inter-kernel `requires`: the four are co-recursive (auth<->session<->
    // socket<->team) and are force-enabled together by KERNEL_MODULES, so
    // declaring requires between them would be both redundant and a validation
    // cycle. Non-kernel modules still declare `requires: ['team']` etc.
    defineModule({ key: 'auth', tier: 'kernel', description: 'Identity, OAuth, JWT, current user' }),
    defineModule({ key: 'session', tier: 'kernel', description: 'Session lifecycle' }),
    defineModule({ key: 'socket', tier: 'kernel', description: 'Realtime gateway' }),
    defineModule({ key: 'team', tier: 'kernel', description: 'Teams, membership, RBAC, secret keys' }),

    // ---- CAPABILITY (optional, consumed via ports) ----
    defineModule({ key: 'system', tier: 'capability', description: 'Deployment settings + system metrics' }),
    defineModule({ key: 'notification', tier: 'capability', optional: ['socket'], description: 'User notifications' }),
    defineModule({ key: 'jobs', tier: 'capability', requires: ['team'], optional: ['socket', 'trajectory'], description: 'Background job tracking' }),
    defineModule({ key: 'ai', tier: 'capability', requires: ['team'], description: 'AI conversations + tool registry' }),

    // ---- COMPUTE (mesh; detachable behind shared contracts) ----
    defineModule({ key: 'cluster', tier: 'compute', requires: ['team'], optional: ['socket', 'analysis', 'trajectory'], description: 'User compute clusters + object gateway' }),
    defineModule({ key: 'container', tier: 'compute', requires: ['team', 'cluster'], optional: ['socket'], description: 'Execution containers' }),
    defineModule({ key: 'trajectory', tier: 'compute', requires: ['team', 'cluster'], optional: ['socket', 'analysis', 'jobs'], description: 'MD trajectories + frames' }),
    defineModule({ key: 'analysis', tier: 'compute', requires: ['team', 'trajectory'], optional: ['socket', 'cluster', 'jobs'], description: 'Plugin analysis runs' }),
    defineModule({ key: 'plugin', tier: 'compute', requires: ['team'], optional: ['trajectory', 'analysis', 'cluster', 'container', 'socket'], description: 'Analysis plugins + registry' }),
    defineModule({ key: 'raster', tier: 'compute', requires: ['team', 'trajectory'], optional: ['cluster', 'container'], description: 'Offscreen rasterization' }),
    defineModule({ key: 'simulation-cell', tier: 'compute', requires: ['team'], optional: ['trajectory'], description: 'Simulation cell library' }),

    // ---- LEAF (freely detachable) ----
    defineModule({ key: 'latex', tier: 'leaf', requires: ['team'], optional: ['ai', 'cluster', 'container', 'socket'], description: 'LaTeX documents + compilation' }),
    defineModule({ key: 'whiteboards', tier: 'leaf', requires: ['team'], optional: ['ai', 'cluster', 'container', 'socket'], description: 'Collaborative whiteboards' }),
    defineModule({ key: 'chat', tier: 'leaf', requires: ['team'], optional: ['socket'], description: 'Team chat' }),
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
 * Resolve the enabled-module set for this process. Precedence:
 * `VOLT_MODULES` env override > DB-persisted list > all registered.
 * KERNEL is force-included and `requires` are transitively closed.
 *
 * `dbEnabled` is passed by the caller (server boot reads DeploymentSettings
 * after Mongo connects); when omitted, only env + defaults are used. The result
 * is cached for the lifetime of the process after the first full resolve.
 */
export const resolveEnabledModules = (dbEnabled?: string[] | null): Set<string> => {
    ensureRegistered();

    const envOverride = readStringArrayEnv('VOLT_MODULES', null);
    const enabled = moduleRegistry.resolveEnabled({ envOverride, dbEnabled: dbEnabled ?? null });

    const { ok, errors } = moduleRegistry.validate(enabled);
    if (!ok) {
        throw new Error(`@modules: invalid enabled-module set:\n  ${errors.join('\n  ')}`);
    }

    cachedEnabled = enabled;
    logger.info(`@modules: enabled=${[...enabled].sort().join(',')}`);
    return enabled;
};

/**
 * The last resolved enabled set. Falls back to env/defaults if boot hasn't
 * resolved with DB settings yet (e.g. during route mounting which precedes the
 * Mongo connection). Safe to call repeatedly.
 */
export const getEnabledModules = (): Set<string> => {
    if (cachedEnabled) return cachedEnabled;
    return resolveEnabledModules(null);
};

/** Whether a given module key is enabled in the resolved set. */
export const isModuleEnabled = (key: string): boolean => getEnabledModules().has(key);
