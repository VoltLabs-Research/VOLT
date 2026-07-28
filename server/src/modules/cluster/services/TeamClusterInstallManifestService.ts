import type { TeamCluster } from '@modules/cluster/contracts/domain/team-cluster';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import type {
    TeamClusterInstallManifestView,
    TeamClusterInstallManifestFileView,
    TeamClusterInstallManifestPortsView
} from '@modules/cluster/services/TeamClusterInstallManifest';
import {
    DaemonDistributionMode,
    getTeamClusterDaemonDistributionMode,
    readTeamClusterDaemonManifestFiles
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

const DAEMON_BUILD_CONTEXT_PREFIX = 'cluster-daemon/';

export const createTeamClusterDaemonBuildContextArchiveBase64 = async (
    files: TeamClusterInstallManifestFileView[]
): Promise<string> => {
    const output = new PassThrough();
    const archive = archiver('tar', {
        gzip: true
    });

    archive.on('error', (error) => output.destroy(error));
    archive.pipe(output);

    for (const file of files) {
        if (!file.path.startsWith(DAEMON_BUILD_CONTEXT_PREFIX)) {
            continue;
        }

        archive.append(`${file.contents}\n`, {
            name: file.path.slice(DAEMON_BUILD_CONTEXT_PREFIX.length),
            mode: parseInt(file.mode, 8)
        });
    }

    await archive.finalize();

    const compressedArchive = await buffer(output);
    return compressedArchive.toString('base64');
};

export class TeamClusterInstallManifestService {
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
            const daemonManifestFiles = await readTeamClusterDaemonManifestFiles();
            daemonFiles = daemonManifestFiles.map((file): TeamClusterInstallManifestFileView => ({
                path: path.posix.join('cluster-daemon', file.relativePath.split(path.sep).join(path.posix.sep)),
                contents: file.contents,
                mode: '0644'
            }));
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
            throw ApplicationError.badRequest('TeamCluster::InvalidInstallRoot', 'Install root is required');
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
                minio: {
                    ...teamCluster.props.services.minio,
                    port: ports.minio
                },
                redis: {
                    ...teamCluster.props.services.redis,
                    port: ports.redis
                },
                mongodb: {
                    ...teamCluster.props.services.mongodb,
                    port: ports.mongodb
                },
                daemon: {
                    ...teamCluster.props.services.daemon,
                    port: ports.daemon
                }
            }
        });

        if (!updateResult.affected) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }
    }
}

export default new TeamClusterInstallManifestService();
