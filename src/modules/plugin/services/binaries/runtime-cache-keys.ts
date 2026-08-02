import { createHash } from 'node:crypto';
import path from 'node:path';
import { DAEMON_PATHS } from '@core/config/paths';

/**
 * Cache identities of artifacts and of the runtimes provisioned from them. These keys
 * address on-disk state, so their composition must stay stable.
 */

const digestOf = (ownerClusterId: string, binaryObjectPath: string, expectedHash?: string) => {
    const digest = createHash('sha256')
        .update(ownerClusterId)
        .update('\0')
        .update(binaryObjectPath)
        .update('\0');

    if (expectedHash) {
        digest.update(expectedHash);
    }

    return digest;
};

export const buildArtifactCacheKey = (
    binaryObjectPath: string,
    ownerClusterId: string,
    expectedHash?: string
): string => {
    const digest = digestOf(ownerClusterId, binaryObjectPath, expectedHash);
    return `${digest.digest('hex')}-${path.basename(binaryObjectPath)}`;
};

/** `variant` separates runtimes of the same artifact, e.g. requirements or entrypoint. */
export const buildRuntimeCacheKey = (
    binaryObjectPath: string,
    ownerClusterId: string,
    expectedHash: string | undefined,
    variant: string
): string => {
    return digestOf(ownerClusterId, binaryObjectPath, expectedHash)
        .update('\0')
        .update(variant)
        .digest('hex');
};

export const runtimeDirectoryFor = (runtimeKey: string): string =>
    path.join(DAEMON_PATHS.pluginBinCache, runtimeKey);
