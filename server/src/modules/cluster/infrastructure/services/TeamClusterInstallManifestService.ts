import TeamCluster from '@modules/cluster/domain/entities/TeamCluster';
import { createTeamClusterDaemonBuildContextArchiveBase64 } from '@modules/cluster/infrastructure/services/install-manifest/TeamClusterDaemonBuildContextArchive';
import {
    DaemonDistributionMode,
    getTeamClusterDaemonDistributionMode,
    readTeamClusterDaemonManifestFiles
} from '@modules/cluster/infrastructure/services/install-manifest/TeamClusterDaemonManifestSource';
import {
    buildTeamClusterInstallManifestFiles,
    sanitizeComposeProjectName,
    TEAM_CLUSTER_IMAGES,
    TEAM_CLUSTER_INSTALL_MANIFEST_VERSION
} from '@modules/cluster/infrastructure/services/install-manifest/TeamClusterInstallManifestFiles';
import { normalizeTeamClusterInstallRoot } from '@modules/cluster/utilities/installRoot';
import ApplicationError from '@shared/application/errors/ApplicationError';
import DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import { Singleton } from '@shared/infrastructure/di/decorators';
import path from 'node:path';

import type {
    TeamClusterInstallManifestDTO,
    TeamClusterInstallManifestFileDTO,
    TeamClusterInstallManifestPortsDTO
} from '@modules/cluster/application/dtos/GenerateTeamClusterInstallManifestDTO';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';

@Singleton()
export default class TeamClusterInstallManifestService {
    constructor(
        
        private readonly daemonCredentialGuard: DaemonCredentialGuard,

        
        private readonly teamClusterRepository: TeamClusterRepository
    ){}

    async generateInstallManifest(
        teamClusterId: string,
        daemonPassword: string,
        installRoot: string,
        ports: TeamClusterInstallManifestPortsDTO
    ): Promise<TeamClusterInstallManifestDTO> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);
        const cloudUrl = this.requireCloudUrl();
        const normalizedInstallRoot = this.requireInstallRoot(installRoot);
        const credentials = await this.daemonCredentialGuard.getDecryptedServiceCredentials(teamCluster);
        const daemonDistributionMode = await getTeamClusterDaemonDistributionMode();

        await this.persistInstallContext(teamCluster, normalizedInstallRoot, ports);

        let daemonFiles: TeamClusterInstallManifestFileDTO[] = [];
        if (daemonDistributionMode === DaemonDistributionMode.Build) {
            const daemonManifestFiles = await readTeamClusterDaemonManifestFiles();
            daemonFiles = daemonManifestFiles.map((file): TeamClusterInstallManifestFileDTO => ({
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
        ports: TeamClusterInstallManifestPortsDTO
    ): Promise<void> {
        const updatedTeamCluster = await this.teamClusterRepository.updateById(teamCluster.id, {
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

        if (!updatedTeamCluster) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }
    }
};
