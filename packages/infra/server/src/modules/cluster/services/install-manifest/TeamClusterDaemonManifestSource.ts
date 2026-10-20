import ApplicationError from '@shared/errors/ApplicationError';
import logger from '@shared/logger';
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

// Build mode ships the slice of the pnpm workspace that packages/infra/cluster/Dockerfile
// builds from: the root manifests plus the daemon and the SDK it links, at their repository
// paths. The server runs from packages/infra/server, so the workspace root is three levels up.
const WORKSPACE_ROOT = path.resolve(process.cwd(), '..', '..', '..');
const WORKSPACE_ROOT_FILES = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];
const WORKSPACE_PACKAGE_DIRS = ['packages/infra/cluster', 'packages/sdk/daemon-cluster-client'];

const DAEMON_MANIFEST_SKIPPED_ENTRIES = new Set(['node_modules', 'dist', '.git', '.runtime']);

const pathExists = async (candidatePath: string): Promise<boolean> => {
    try {
        await access(candidatePath);
        return true;
    } catch {
        return false;
    }
};

const hasDaemonBuildContext = async (): Promise<boolean> => {
    const entries = [...WORKSPACE_ROOT_FILES, ...WORKSPACE_PACKAGE_DIRS];
    const found = await Promise.all(entries.map((entry) => pathExists(path.join(WORKSPACE_ROOT, entry))));
    return found.every(Boolean);
};

const decodeManifestText = (contents: Buffer): string | null => {
    try {
        return new TextDecoder('utf8', { fatal: true }).decode(contents);
    } catch {
        return null;
    }
};

const readManifestFile = async (absolutePath: string): Promise<DaemonManifestFile | null> => {
    const relativePath = path.relative(WORKSPACE_ROOT, absolutePath);
    const contents = decodeManifestText(await readFile(absolutePath));
    if (contents === null) {
        logger.warn(`@install-manifest: skipped non-UTF-8 file ${relativePath}`);
        return null;
    }

    return {
        relativePath,
        contents
    };
};

const walkManifestFiles = async (currentPath: string): Promise<DaemonManifestFile[]> => {
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
            manifestFiles.push(...await walkManifestFiles(absolutePath));
            continue;
        }

        const manifestFile = await readManifestFile(absolutePath);
        if (manifestFile) {
            manifestFiles.push(manifestFile);
        }
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

    if (await hasDaemonBuildContext()) {
        return DaemonDistributionMode.Build;
    }

    return DaemonDistributionMode.Image;
};

export const readTeamClusterDaemonBuildContextFiles = async (): Promise<DaemonManifestFile[]> => {
    if (!await hasDaemonBuildContext()) {
        throw ApplicationError.internalServerError('Unable to locate the VOLT workspace sources (cluster daemon and SDK) for build distribution mode');
    }

    const manifestFiles: DaemonManifestFile[] = [];
    for (const rootFile of WORKSPACE_ROOT_FILES) {
        const manifestFile = await readManifestFile(path.join(WORKSPACE_ROOT, rootFile));
        if (manifestFile) {
            manifestFiles.push(manifestFile);
        }
    }

    for (const packageDir of WORKSPACE_PACKAGE_DIRS) {
        manifestFiles.push(...await walkManifestFiles(path.join(WORKSPACE_ROOT, packageDir)));
    }

    return manifestFiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};
