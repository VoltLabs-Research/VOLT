import { moduleRegistry } from '@shared/infrastructure/modules/ModuleRegistry';
import { defineModule } from '@shared/infrastructure/modules/defineModule';
import { readStringArrayEnv } from '@shared/infrastructure/utilities/env';
import { logger } from '@shared/infrastructure/logger';

const MODULE_MANIFESTS = [
    defineModule({ key: 'system', tier: 'kernel', description: 'Runtime role, metrics and heartbeat plane' }),
    defineModule({ key: 'container', tier: 'kernel', description: 'Cloud connections, reverse channel, docker runtime access' }),

    defineModule({ key: 'jobs', tier: 'capability', optional: ['analysis', 'plugin', 'trajectory'], description: 'Queue job control and status reporting' }),

    defineModule({ key: 'plugin', tier: 'compute', requires: ['jobs'], optional: ['analysis'], description: 'Plugin binaries, exports and property stores' }),
    defineModule({ key: 'trajectory', tier: 'compute', requires: ['jobs', 'plugin'], optional: ['analysis'], description: 'Trajectory parsing, framing, raster and glb' }),
    defineModule({ key: 'analysis', tier: 'compute', requires: ['jobs', 'plugin', 'trajectory'], description: 'Analysis and pipeline workflow execution' }),

    defineModule({ key: 'notebook', tier: 'leaf', requires: ['container'], description: 'Jupyter notebook runtime' })
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

    const envOverride = readStringArrayEnv('DAEMON_MODULES', null);
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
