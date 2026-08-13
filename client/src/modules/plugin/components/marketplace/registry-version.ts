import semver from 'semver';

import type { Plugin } from '@volt/contracts/modules/plugin/plugin';

/*
 * Registry versions are not guaranteed to be strict semver, so both sides are
 * coerced before comparing; an uncomparable pair reports "not newer" rather than
 * offering an update that may be a downgrade.
 */
export const isNewerVersion = (latest: string, installed: string): boolean => {
    const left = semver.coerce(latest, { includePrerelease: true }) ?? semver.coerce(latest);
    const right = semver.coerce(installed, { includePrerelease: true }) ?? semver.coerce(installed);

    if (!left || !right) return false;

    return semver.gt(left, right);
};

/**
 * Installed version per modifier key — the key, not the plugin name, is what a
 * registry package shares with its installed copy.
 */
export const buildInstalledVersionIndex = (plugins: readonly Plugin[]): Map<string, string> => {
    const index = new Map<string, string>();

    for (const plugin of plugins) {
        if (plugin.modifier?.key) {
            index.set(plugin.modifier.key, plugin.modifier.version ?? '');
        }
    }

    return index;
};

export type MarketplaceInstallState = 'install' | 'update' | 'installed';

export const resolveInstallState = (
    latest: string | undefined,
    installedVersion: string | undefined
): MarketplaceInstallState => {
    if (installedVersion === undefined) return 'install';
    if (latest && isNewerVersion(latest, installedVersion)) return 'update';
    return 'installed';
};
