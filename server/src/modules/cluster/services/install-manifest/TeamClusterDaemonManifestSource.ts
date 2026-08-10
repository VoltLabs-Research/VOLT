import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

interface DaemonManifestFile {
    relativePath: string;
    contents: string;
}

export enum DaemonDistributionMode {
    Build = 'build',
    Image = 'image'
}

/*
 * The daemon lives at `cluster/` inside this repository; the stack compose keeps
 * mounting it at `/ClusterDaemon` (with the SDK at `/VoltSdk`) for this flow.
 */
const DAEMON_SOURCE_ROOT_CANDIDATES = [
    path.resolve(process.cwd(), '..', '..', 'ClusterDaemon'),
    path.resolve(process.cwd(), '..', 'cluster')
];

/*
 * The daemon links @voltstack/daemon-cluster-client from the repository, so the
 * build context shipped to enrolled hosts must carry the SDK package alongside
 * the daemon source. `../../sdk/...` covers both the repository layout (server
 * run from `server/`) and the stack compose mount (`/sdk`).
 */
const SDK_PACKAGE_RELATIVE_PATH = ['sdk', 'node', 'DaemonClusterClient'];

const SDK_SOURCE_ROOT_CANDIDATES = [
    path.resolve(process.cwd(), '..', ...SDK_PACKAGE_RELATIVE_PATH),
    path.resolve(process.cwd(), '..', '..', ...SDK_PACKAGE_RELATIVE_PATH)
];

const resolveExistingPath = async (candidatePaths: readonly string[]): Promise<string | null> => {
    for (const candidatePath of candidatePaths) {
        try {
            await access(candidatePath);
            return candidatePath;
        } catch {
            continue;
        }
    }

    return null;
};

const resolveDaemonPackageRoot = async (): Promise<string | null> => {
    return resolveExistingPath(DAEMON_SOURCE_ROOT_CANDIDATES);
};

const resolveSdkPackageRoot = async (): Promise<string | null> => {
    return resolveExistingPath(SDK_SOURCE_ROOT_CANDIDATES);
};

const requireDaemonPackageRoot = async (): Promise<string> => {
    const daemonPackageRoot = await resolveDaemonPackageRoot();
    if (!daemonPackageRoot) {
        throw ApplicationError.internalServerError('Unable to locate local ClusterDaemon source directory for build distribution mode');
    }

    return daemonPackageRoot;
};

const requireSdkPackageRoot = async (): Promise<string> => {
    const sdkPackageRoot = await resolveSdkPackageRoot();
    if (!sdkPackageRoot) {
        throw ApplicationError.internalServerError('Unable to locate local DaemonClusterClient SDK source directory for build distribution mode');
    }

    return sdkPackageRoot;
};

const DAEMON_MANIFEST_SKIPPED_ENTRIES = new Set(['node_modules', 'dist', '.git', '.runtime']);

/**
 * Manifest files travel as strings, so a file that is not valid UTF-8 cannot be
 * represented. Decoding it leniently would silently corrupt it, so binary files
 * are omitted instead and reported.
 */
const decodeManifestText = (contents: Buffer): string | null => {
    try {
        return new TextDecoder('utf8', { fatal: true }).decode(contents);
    } catch {
        return null;
    }
};

const walkManifestFiles = async (sourceRoot: string, currentPath: string): Promise<DaemonManifestFile[]> => {
    const manifestFiles: DaemonManifestFile[] = [];
    const entries = await readdir(currentPath, {
        withFileTypes: true
    });

    for (const entry of entries) {
        if (DAEMON_MANIFEST_SKIPPED_ENTRIES.has(entry.name)) {
            continue;
        }

        const absolutePath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
            manifestFiles.push(...await walkManifestFiles(sourceRoot, absolutePath));
            continue;
        }

        const contents = decodeManifestText(await readFile(absolutePath));
        if (contents === null) {
            logger.warn(`@install-manifest: skipped non-UTF-8 file ${path.relative(sourceRoot, absolutePath)}`);
            continue;
        }

        manifestFiles.push({
            relativePath: path.relative(sourceRoot, absolutePath),
            contents
        });
    }

    return manifestFiles;
};

export const getTeamClusterDaemonDistributionMode = async (): Promise<DaemonDistributionMode> => {
    const rawDistributionMode = process.env.TEAM_CLUSTER_DAEMON_DISTRIBUTION_MODE?.trim().toLowerCase();
    if (rawDistributionMode === DaemonDistributionMode.Build) {
        return DaemonDistributionMode.Build;
    }

    if (rawDistributionMode === DaemonDistributionMode.Image) {
        return DaemonDistributionMode.Image;
    }

    /*
     * Build mode ships the daemon source to the host and builds it there; the
     * daemon's SDK link must travel with it, so both roots are required.
     */
    if (await resolveDaemonPackageRoot() && await resolveSdkPackageRoot()) {
        return DaemonDistributionMode.Build;
    }

    return DaemonDistributionMode.Image;
};

const sortByRelativePath = (manifestFiles: DaemonManifestFile[]): DaemonManifestFile[] => {
    return manifestFiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};

export const readTeamClusterDaemonManifestFiles = async (): Promise<DaemonManifestFile[]> => {
    const daemonRoot = await requireDaemonPackageRoot();
    return sortByRelativePath(await walkManifestFiles(daemonRoot, daemonRoot));
};

export const readTeamClusterSdkManifestFiles = async (): Promise<DaemonManifestFile[]> => {
    const sdkRoot = await requireSdkPackageRoot();
    return sortByRelativePath(await walkManifestFiles(sdkRoot, sdkRoot));
};
