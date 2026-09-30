import { createHash } from 'node:crypto';
import path from 'node:path';
import { DAEMON_PATHS } from '@core/config/paths';


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

export const windowsExecutableName = (fileName: string): string => {
    if (process.platform !== 'win32') return fileName;
    return path.extname(fileName) ? fileName : `${fileName}.exe`;
};

export const buildArtifactCacheKey = (
    binaryObjectPath: string,
    ownerClusterId: string,
    expectedHash?: string
): string => {
    const digest = digestOf(ownerClusterId, binaryObjectPath, expectedHash);
    return `${digest.digest('hex')}-${windowsExecutableName(path.basename(binaryObjectPath))}`;
};

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
