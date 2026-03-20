import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

interface DaemonManifestFile {
    relativePath: string;
    contents: string;
};

export enum DaemonDistributionMode {
    Build = 'build',
    Image = 'image'
};

const DAEMON_SOURCE_ROOT_CANDIDATES = [
    path.resolve(process.cwd(), '..', 'cluster-daemon'),
    path.resolve(process.cwd(), '..', 'ClusterDaemon'),
    path.resolve(process.cwd(), '..', '..', 'ClusterDaemon'),
    path.resolve(process.cwd(), 'app', 'ClusterDaemon')
];

const resolveDaemonPackageRoot = async (): Promise<string | null> => {
    for (const candidatePath of DAEMON_SOURCE_ROOT_CANDIDATES) {
        try {
            await access(candidatePath);
            return candidatePath;
        } catch {
            continue;
        }
    }

    return null;
};

const requireDaemonPackageRoot = async (): Promise<string> => {
    const daemonPackageRoot = await resolveDaemonPackageRoot();
    if (!daemonPackageRoot) {
        throw ApplicationError.internalServerError('Unable to locate local ClusterDaemon source directory for build distribution mode');
    }

    return daemonPackageRoot;
};

const walkDaemonManifestFiles = async (daemonRoot: string, currentPath: string): Promise<DaemonManifestFile[]> => {
    const daemonFiles: DaemonManifestFile[] = [];
    const entries = await readdir(currentPath, {
        withFileTypes: true
    });

    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist') {
            continue;
        }

        const absolutePath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
            daemonFiles.push(...await walkDaemonManifestFiles(daemonRoot, absolutePath));
            continue;
        }

        daemonFiles.push({
            relativePath: path.relative(daemonRoot, absolutePath),
            contents: await readFile(absolutePath, 'utf8')
        });
    }

    return daemonFiles;
};

export const getTeamClusterDaemonDistributionMode = async (): Promise<DaemonDistributionMode> => {
    const rawDistributionMode = process.env.TEAM_CLUSTER_DAEMON_DISTRIBUTION_MODE?.trim().toLowerCase();
    if (rawDistributionMode === DaemonDistributionMode.Build) {
        return DaemonDistributionMode.Build;
    }

    if (rawDistributionMode === DaemonDistributionMode.Image) {
        return DaemonDistributionMode.Image;
    }

    if (await resolveDaemonPackageRoot()) {
        return DaemonDistributionMode.Build;
    }

    return DaemonDistributionMode.Image;
};

export const readTeamClusterDaemonManifestFiles = async (): Promise<DaemonManifestFile[]> => {
    const daemonRoot = await requireDaemonPackageRoot();
    const daemonFiles = await walkDaemonManifestFiles(daemonRoot, daemonRoot);

    return daemonFiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};
