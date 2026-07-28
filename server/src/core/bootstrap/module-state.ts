import { moduleRegistry } from '@shared/infrastructure/modules/ModuleRegistry';
import { defineModule } from '@shared/infrastructure/modules/defineModule';
import { readStringArrayEnv } from '@shared/infrastructure/utilities/env';
import logger from '@shared/infrastructure/logger';

const MODULE_MANIFESTS = [
    defineModule({
        key: 'auth',
        tier: 'kernel',
        description: 'Identity, OAuth, JWT, current user'
    }),
    defineModule({
        key: 'session',
        tier: 'kernel',
        description: 'Session lifecycle'
    }),
    defineModule({
        key: 'socket',
        tier: 'kernel',
        description: 'Realtime gateway'
    }),
    defineModule({
        key: 'team',
        tier: 'kernel',
        description: 'Teams, membership, RBAC, secret keys'
    }),
    defineModule({
        key: 'system',
        tier: 'kernel',
        description: 'Deployment settings + system metrics + boot config'
    }),

    defineModule({
        key: 'notification',
        tier: 'capability',
        description: 'User notifications'
    }),
    defineModule({
        key: 'jobs',
        tier: 'capability',
        requires: ['team'],
        optional: ['trajectory'],
        description: 'Background job tracking'
    }),
    defineModule({
        key: 'ai',
        tier: 'capability',
        requires: ['team'],
        description: 'AI conversations + tool registry'
    }),

    defineModule({
        key: 'cluster',
        tier: 'compute',
        requires: ['team', 'system'],
        optional: ['analysis', 'trajectory'],
        description: 'User compute clusters + object gateway'
    }),
    defineModule({
        key: 'container',
        tier: 'compute',
        requires: ['team', 'cluster', 'system'],
        description: 'Execution containers'
    }),
    defineModule({
        key: 'trajectory',
        tier: 'compute',
        requires: ['team', 'cluster'],
        optional: ['analysis', 'jobs'],
        description: 'MD trajectories + frames'
    }),
    defineModule({
        key: 'analysis',
        tier: 'compute',
        requires: ['team', 'trajectory'],
        optional: ['cluster', 'jobs'],
        description: 'Plugin analysis runs'
    }),
    defineModule({
        key: 'plugin',
        tier: 'compute',
        requires: ['team'],
        optional: ['trajectory', 'analysis', 'cluster', 'container'],
        description: 'Analysis plugins + registry'
    }),
    defineModule({
        key: 'raster',
        tier: 'compute',
        requires: ['team', 'trajectory'],
        optional: ['cluster', 'container'],
        description: 'Offscreen rasterization'
    }),
    defineModule({
        key: 'simulation-cell',
        tier: 'compute',
        requires: ['team'],
        optional: ['trajectory'],
        description: 'Simulation cell library'
    }),

    defineModule({
        key: 'latex',
        tier: 'leaf',
        requires: ['team'],
        optional: ['ai', 'cluster', 'container'],
        description: 'LaTeX documents + compilation'
    }),
    defineModule({
        key: 'whiteboards',
        tier: 'leaf',
        requires: ['team'],
        optional: ['ai', 'cluster', 'container'],
        description: 'Collaborative whiteboards'
    }),
    defineModule({
        key: 'chat',
        tier: 'leaf',
        requires: ['team'],
        description: 'Team chat'
    }),
    defineModule({
        key: 'scripting',
        tier: 'leaf',
        requires: ['team', 'container'],
        optional: ['cluster'],
        description: 'Jupyter notebooks'
    }),
    defineModule({
        key: 'dashboard',
        tier: 'leaf',
        requires: ['team'],
        optional: ['analysis', 'chat', 'container', 'plugin', 'trajectory'],
        description: 'Dashboard aggregation'
    }),
    defineModule({
        key: 'daily-activity',
        tier: 'leaf',
        requires: ['team'],
        description: 'Activity log'
    })
];

let registered = false;
let cachedEnabled: Set<string> | null = null;

const ensureRegistered = (): void => {
    if (registered) return;
    for (const manifest of MODULE_MANIFESTS) {
        moduleRegistry.register(manifest);
    }
    registered = true;
};

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

export const getEnabledModules = (): Set<string> => {
    if (cachedEnabled) return cachedEnabled;
    cachedEnabled = resolveEnabledModules();
    logger.info(`@modules: enabled=${[...cachedEnabled].sort().join(',')}`);
    return cachedEnabled;
};

export const isModuleEnabled = (key: string): boolean => getEnabledModules().has(key);
