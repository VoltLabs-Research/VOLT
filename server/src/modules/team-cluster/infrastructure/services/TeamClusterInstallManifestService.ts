import TeamCluster from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import {
    DaemonDistributionMode,
    getTeamClusterDaemonDistributionMode,
    readTeamClusterDaemonManifestFiles
} from '@modules/team-cluster/infrastructure/services/install-manifest/TeamClusterDaemonManifestSource';
import { createTeamClusterDaemonBuildContextArchiveBase64 } from '@modules/team-cluster/infrastructure/services/install-manifest/TeamClusterDaemonBuildContextArchive';
import {
    buildTeamClusterInstallManifestFiles,
    sanitizeComposeProjectName,
    TEAM_CLUSTER_IMAGES,
    TEAM_CLUSTER_INSTALL_MANIFEST_VERSION
} from '@modules/team-cluster/infrastructure/services/install-manifest/TeamClusterInstallManifestFiles';
import { normalizeTeamClusterInstallRoot } from '@modules/team-cluster/utilities/installRoot';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import path from 'node:path';
import { inject, injectable } from 'tsyringe';

import type {
    TeamClusterInstallManifestDTO,
    TeamClusterInstallManifestFileDTO,
    TeamClusterInstallManifestPortsDTO
} from '@modules/team-cluster/application/dtos/GenerateTeamClusterInstallManifestDTO';

@injectable()
export default class TeamClusterInstallManifestService {
    constructor(
        @inject(SHARED_TOKENS.DaemonCredentialGuard)
        private readonly daemonCredentialGuard: DaemonCredentialGuard,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
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
