import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamCluster } from '@modules/cluster/contracts/team-cluster';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import type {
    TeamClusterInstallManifestView,
    TeamClusterInstallManifestFileView,
    TeamClusterInstallManifestPortsView
} from '@modules/cluster/services/TeamClusterInstallManifest';
import {
    DaemonDistributionMode,
    getTeamClusterDaemonDistributionMode,
    readTeamClusterDaemonManifestFiles,
    readTeamClusterSdkManifestFiles
} from '@modules/cluster/services/install-manifest/TeamClusterDaemonManifestSource';
import {
    buildTeamClusterInstallManifestFiles,
    sanitizeComposeProjectName,
    TEAM_CLUSTER_IMAGES,
    TEAM_CLUSTER_INSTALL_MANIFEST_VERSION
} from '@modules/cluster/services/install-manifest/TeamClusterInstallManifestFiles';
import { normalizeTeamClusterInstallRoot } from '@modules/cluster/services/TeamClusterInstallRoot';
import ApplicationError from '@shared/application/errors/ApplicationError';
import DaemonCredentialGuard from '@modules/cluster/services/DaemonCredentialGuard';
import archiver from 'archiver';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { buffer } from 'node:stream/consumers';

/*
 * The build context extracted on the host mirrors the repository layout the
 * daemon's Dockerfiles expect: `cluster/` (the daemon) plus `sdk/` (the
 * DaemonClusterClient package it links).
 */
const DAEMON_BUILD_CONTEXT_PREFIX = 'cluster/';
const SDK_BUILD_CONTEXT_PREFIX = 'sdk/';
const BUILD_CONTEXT_PREFIXES = [DAEMON_BUILD_CONTEXT_PREFIX, SDK_BUILD_CONTEXT_PREFIX];

const createTeamClusterDaemonBuildContextArchiveBase64 = async (
    files: TeamClusterInstallManifestFileView[]
): Promise<string> => {
    const output = new PassThrough();
    const archive = archiver('tar', {
        gzip: true
    });

    archive.on('error', (error) => output.destroy(error));
    archive.pipe(output);

    for (const file of files) {
        if (!BUILD_CONTEXT_PREFIXES.some((prefix) => file.path.startsWith(prefix))) {
            continue;
        }

        archive.append(`${file.contents}\n`, {
            name: file.path,
            mode: parseInt(file.mode, 8)
        });
    }

    await archive.finalize();

    const compressedArchive = await buffer(output);
    return compressedArchive.toString('base64');
};

class TeamClusterInstallManifestService {
    private readonly daemonCredentialGuard = new DaemonCredentialGuard();

    async generateInstallManifest(
        teamClusterId: string,
        daemonPassword: string,
        installRoot: string,
        ports: TeamClusterInstallManifestPortsView
    ): Promise<TeamClusterInstallManifestView> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);
        const cloudUrl = this.requireCloudUrl();
        const normalizedInstallRoot = this.requireInstallRoot(installRoot);
        const credentials = await this.daemonCredentialGuard.getDecryptedServiceCredentials(teamCluster);
        const daemonDistributionMode = await getTeamClusterDaemonDistributionMode();

        await this.persistInstallContext(teamCluster, normalizedInstallRoot, ports);

        let daemonFiles: TeamClusterInstallManifestFileView[] = [];
        if (daemonDistributionMode === DaemonDistributionMode.Build) {
            const toBuildContextFile = (prefix: string) => {
                return (file: { relativePath: string; contents: string }): TeamClusterInstallManifestFileView => ({
                    path: path.posix.join(prefix, file.relativePath.split(path.sep).join(path.posix.sep)),
                    contents: file.contents,
                    mode: '0644'
                });
            };

            const daemonManifestFiles = await readTeamClusterDaemonManifestFiles();
            const sdkManifestFiles = await readTeamClusterSdkManifestFiles();
            daemonFiles = [
                ...daemonManifestFiles.map(toBuildContextFile('cluster')),
                ...sdkManifestFiles.map(toBuildContextFile(path.posix.join('sdk', 'node', 'DaemonClusterClient')))
            ];
        }

        const files = buildTeamClusterInstallManifestFiles({
            teamId: teamCluster.props.team,
            teamClusterId: teamCluster.id,
            installRoot: normalizedInstallRoot,
            ports,
            cloudUrl,
            credentials,
            daemonDistributionMode,
            daemonFiles
        });

        let buildContextArchiveBase64: string | undefined;
        if (daemonDistributionMode === DaemonDistributionMode.Build) {
            buildContextArchiveBase64 = await createTeamClusterDaemonBuildContextArchiveBase64(files);
        }

        return {
            manifestVersion: TEAM_CLUSTER_INSTALL_MANIFEST_VERSION,
            composeProjectName: sanitizeComposeProjectName(teamCluster.id),
            ...(buildContextArchiveBase64 ? { buildContextArchiveBase64 } : {}),
            files,
            images: TEAM_CLUSTER_IMAGES
        };
    }

    private requireCloudUrl(): string {
        const rawCloudUrl = process.env.SERVER_ENDPOINT?.trim();
        if (!rawCloudUrl) {
            throw ApplicationError.internalServerError('SERVER_ENDPOINT is required to generate the team cluster install manifest');
        }

        return rawCloudUrl.replace(/\/+$/g, '');
    }

    private requireInstallRoot(installRoot: string): string {
        const normalizedInstallRoot = normalizeTeamClusterInstallRoot(installRoot);
        if (!normalizedInstallRoot) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_CLUSTER_INVALID_INSTALL_ROOT, 'Install root is required');
        }

        return normalizedInstallRoot;
    }

    private async persistInstallContext(
        teamCluster: TeamCluster,
        installRoot: string,
        ports: TeamClusterInstallManifestPortsView
    ): Promise<void> {
        const updateResult = await TeamClusterEntity.update({ id: teamCluster.id }, {
            installRoot,
            services: {
                postgres: {
                    ...teamCluster.props.services.postgres,
                    port: ports.postgres
                },
                daemon: {
                    ...teamCluster.props.services.daemon,
                    port: ports.daemon
                }
            }
        });

        if (!updateResult.affected) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 'Team cluster not found');
        }
    }
}

export default new TeamClusterInstallManifestService();
